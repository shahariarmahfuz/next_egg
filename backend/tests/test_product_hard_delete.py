import uuid
from datetime import datetime, timezone
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.product import Product
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import Sale, SaleItem
from app.models.sale_return import SaleReturn, SaleReturnItem
from app.models.product_return import ProductReturn, ProductReturnItem
from app.models.inventory_batch import InventoryBatch
from app.services.product_service import product_service
from app.exceptions.custom import NotFoundException
from app.main import create_app
from app.dependencies.db import get_db
from app.core.security import create_access_token


@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def app_with_test_db(test_db: AsyncSession):
    app = create_app()

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authorized_user(test_db: AsyncSession):
    # Permission for product.delete
    perm = Permission(
        id=str(uuid.uuid4()),
        code="product.delete",
        name="Delete Product",
        module="product",
    )
    test_db.add(perm)

    role = Role(
        id=str(uuid.uuid4()),
        name="Product Manager",
        code="product_manager",
        is_system=True,
    )
    role.permissions.append(perm)
    test_db.add(role)
    await test_db.flush()

    user = User(
        id=str(uuid.uuid4()),
        username="authorized_admin",
        email="auth_admin@example.com",
        password_hash="secure_hash",
        full_name="Authorized Admin",
        role_id=role.id,
        status="active",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def unauthorized_user(test_db: AsyncSession):
    role = Role(
        id=str(uuid.uuid4()),
        name="Viewer",
        code="viewer",
        is_system=True,
    )
    test_db.add(role)
    await test_db.flush()

    user = User(
        id=str(uuid.uuid4()),
        username="unauthorized_viewer",
        email="viewer@example.com",
        password_hash="secure_hash",
        full_name="Unauthorized Viewer",
        role_id=role.id,
        status="active",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_hard_delete_product_service_cleans_linked_records_and_preserves_unrelated(test_db: AsyncSession, authorized_user: User):
    """
    Regression test verifying:
    1. Product hard delete does NOT fail with:
       'No module named app.models.farm_transaction'
    2. Linked SaleItem, PurchaseItem, SaleReturnItem, ProductReturnItem, InventoryBatch are deleted.
    3. Unrelated products and their linked records remain completely untouched.
    """
    # 1. Create Target Product A
    prod_a = Product(
        id=str(uuid.uuid4()),
        product_code="PROD-TARGET-001",
        name="Target Product For Deletion",
        unit="pcs",
        opening_stock=100.0,
        current_stock=100.0,
        selling_price=50.0,
        status="active",
    )
    # 2. Create Unrelated Product B
    prod_b = Product(
        id=str(uuid.uuid4()),
        product_code="PROD-UNRELATED-002",
        name="Unrelated Product To Preserve",
        unit="pcs",
        opening_stock=200.0,
        current_stock=200.0,
        selling_price=60.0,
        status="active",
    )
    test_db.add_all([prod_a, prod_b])

    # Supporting entities
    supp = Supplier(
        id=str(uuid.uuid4()),
        supplier_code="SUP-TEST-01",
        name="Test Supplier",
    )
    cust = Customer(
        id=str(uuid.uuid4()),
        customer_code="CUST-TEST-01",
        name="Test Customer",
    )
    test_db.add_all([supp, cust])
    await test_db.flush()

    now = datetime.now(timezone.utc)

    # Purchases & PurchaseItems
    pur_a = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-001",
        supplier_id=supp.id,
        user_id=authorized_user.id,
        purchase_date=now,
        grand_total=500.0,
        due_amount=500.0,
        payment_status="unpaid",
    )
    pur_item_a = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=pur_a.id,
        product_id=prod_a.id,
        quantity=10.0,
        unit_price=50.0,
        total_price=500.0,
    )
    pur_b = Purchase(
        id=str(uuid.uuid4()),
        purchase_no="PO-002",
        supplier_id=supp.id,
        user_id=authorized_user.id,
        purchase_date=now,
        grand_total=600.0,
        due_amount=600.0,
        payment_status="unpaid",
    )
    pur_item_b = PurchaseItem(
        id=str(uuid.uuid4()),
        purchase_id=pur_b.id,
        product_id=prod_b.id,
        quantity=10.0,
        unit_price=60.0,
        total_price=600.0,
    )
    test_db.add_all([pur_a, pur_item_a, pur_b, pur_item_b])

    # Sales & SaleItems
    sale_a = Sale(
        id=str(uuid.uuid4()),
        invoice_no="INV-001",
        customer_id=cust.id,
        user_id=authorized_user.id,
        sale_date=now,
        grand_total=250.0,
        due_amount=250.0,
        payment_status="unpaid",
    )
    sale_item_a = SaleItem(
        id=str(uuid.uuid4()),
        sale_id=sale_a.id,
        product_id=prod_a.id,
        quantity=5.0,
        unit_price=50.0,
        total_price=250.0,
    )
    sale_b = Sale(
        id=str(uuid.uuid4()),
        invoice_no="INV-002",
        customer_id=cust.id,
        user_id=authorized_user.id,
        sale_date=now,
        grand_total=300.0,
        due_amount=300.0,
        payment_status="unpaid",
    )
    sale_item_b = SaleItem(
        id=str(uuid.uuid4()),
        sale_id=sale_b.id,
        product_id=prod_b.id,
        quantity=5.0,
        unit_price=60.0,
        total_price=300.0,
    )
    test_db.add_all([sale_a, sale_item_a, sale_b, sale_item_b])

    # Sale Return
    s_ret = SaleReturn(
        id=str(uuid.uuid4()),
        return_no="SR-001",
        sale_id=sale_a.id,
        customer_id=cust.id,
        user_id=authorized_user.id,
        return_date=now,
        grand_total=50.0,
    )
    s_ret_item = SaleReturnItem(
        id=str(uuid.uuid4()),
        sale_return_id=s_ret.id,
        product_id=prod_a.id,
        quantity=1.0,
        unit_price=50.0,
        total_price=50.0,
    )
    test_db.add_all([s_ret, s_ret_item])

    # Product Return
    p_ret = ProductReturn(
        id=str(uuid.uuid4()),
        return_no="PR-001",
        purchase_id=pur_a.id,
        supplier_id=supp.id,
        user_id=authorized_user.id,
        return_date=now,
        grand_total=50.0,
    )
    p_ret_item = ProductReturnItem(
        id=str(uuid.uuid4()),
        product_return_id=p_ret.id,
        product_id=prod_a.id,
        quantity=1.0,
        unit_price=50.0,
        total_price=50.0,
    )
    test_db.add_all([p_ret, p_ret_item])

    # Inventory batches
    batch_a = InventoryBatch(
        id=str(uuid.uuid4()),
        product_id=prod_a.id,
        purchase_id=pur_a.id,
        quantity=10.0,
        remaining_quantity=10.0,
        unit_cost=50.0,
        purchase_date=now,
    )
    batch_b = InventoryBatch(
        id=str(uuid.uuid4()),
        product_id=prod_b.id,
        purchase_id=pur_b.id,
        quantity=10.0,
        remaining_quantity=10.0,
        unit_cost=60.0,
        purchase_date=now,
    )
    test_db.add_all([batch_a, batch_b])
    await test_db.commit()

    # Execute hard_delete_product for Product A
    res = await product_service.hard_delete_product(test_db, prod_a.id)
    assert res is True

    # 1. Product A is gone
    prod_a_check = (await test_db.execute(select(Product).where(Product.id == prod_a.id))).scalar_one_or_none()
    assert prod_a_check is None

    # 2. Product A's line items and batches are gone
    assert (await test_db.execute(select(PurchaseItem).where(PurchaseItem.product_id == prod_a.id))).scalar_one_or_none() is None
    assert (await test_db.execute(select(SaleItem).where(SaleItem.product_id == prod_a.id))).scalar_one_or_none() is None
    assert (await test_db.execute(select(SaleReturnItem).where(SaleReturnItem.product_id == prod_a.id))).scalar_one_or_none() is None
    assert (await test_db.execute(select(ProductReturnItem).where(ProductReturnItem.product_id == prod_a.id))).scalar_one_or_none() is None
    assert (await test_db.execute(select(InventoryBatch).where(InventoryBatch.product_id == prod_a.id))).scalar_one_or_none() is None

    # 3. Product B and ALL its related records remain intact
    prod_b_check = (await test_db.execute(select(Product).where(Product.id == prod_b.id))).scalar_one_or_none()
    assert prod_b_check is not None
    assert prod_b_check.product_code == "PROD-UNRELATED-002"

    pur_item_b_check = (await test_db.execute(select(PurchaseItem).where(PurchaseItem.product_id == prod_b.id))).scalar_one_or_none()
    assert pur_item_b_check is not None

    sale_item_b_check = (await test_db.execute(select(SaleItem).where(SaleItem.product_id == prod_b.id))).scalar_one_or_none()
    assert sale_item_b_check is not None

    batch_b_check = (await test_db.execute(select(InventoryBatch).where(InventoryBatch.product_id == prod_b.id))).scalar_one_or_none()
    assert batch_b_check is not None


@pytest.mark.asyncio
async def test_hard_delete_product_non_existent_raises_not_found(test_db: AsyncSession):
    with pytest.raises(NotFoundException):
        await product_service.hard_delete_product(test_db, "non-existent-product-id")


@pytest.mark.asyncio
async def test_hard_delete_product_endpoint_rbac_and_execution(
    app_with_test_db,
    test_db: AsyncSession,
    authorized_user: User,
    unauthorized_user: User,
):
    """
    Test endpoint /api/v1/products/{product_id}/hard-delete:
    1. Unauthenticated request -> 401
    2. Unauthorized user (missing product.delete) -> 403
    3. Authorized user -> 200 with successful deletion
    """
    # Create product to delete
    prod = Product(
        id=str(uuid.uuid4()),
        product_code="PROD-API-001",
        name="API Test Product",
        unit="pcs",
        opening_stock=10.0,
        current_stock=10.0,
        selling_price=100.0,
        status="active",
    )
    test_db.add(prod)
    await test_db.commit()

    async with AsyncClient(transport=ASGITransport(app=app_with_test_db), base_url="http://test") as client:
        # 1. Unauthenticated -> 401
        res_no_auth = await client.delete(f"/api/v1/products/{prod.id}/hard-delete")
        assert res_no_auth.status_code == 401

        # 2. Unauthorized user -> 403
        unauth_token = create_access_token(subject=unauthorized_user.id)
        res_unauth = await client.delete(
            f"/api/v1/products/{prod.id}/hard-delete",
            headers={"Authorization": f"Bearer {unauth_token}"},
        )
        assert res_unauth.status_code == 403

        # 3. Authorized user -> 200
        auth_token = create_access_token(subject=authorized_user.id)
        res_auth = await client.delete(
            f"/api/v1/products/{prod.id}/hard-delete",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert res_auth.status_code == 200
        json_data = res_auth.json()
        assert json_data["success"] is True
        assert json_data["data"]["id"] == prod.id
        assert json_data["message"] == "Product and all related transaction items deleted permanently"

        # Verify product is deleted from database
        deleted_prod = (await test_db.execute(select(Product).where(Product.id == prod.id))).scalar_one_or_none()
        assert deleted_prod is None
