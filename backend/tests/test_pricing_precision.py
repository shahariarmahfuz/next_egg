import uuid
import pytest
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from app.main import create_app
from app.db.session import AsyncSessionLocal, engine
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.product import Product
from app.repositories.user_repository import user_repository

app = create_app()


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
async def auth_headers(async_client):
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "Owner@Argon2Secure2026!"},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_entities():
    """Create dedicated customer, supplier, and product with plenty of stock for testing."""
    unique_suffix = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        customer = Customer(
            customer_code=f"CUST-TEST-{unique_suffix}",
            name=f"Precision Test Customer {unique_suffix}",
            opening_balance=0.0,
            current_balance=0.0,
            advance_balance=0.0,
            credit_limit=1000000.0,
            status="active",
        )
        supplier = Supplier(
            supplier_code=f"SUPP-TEST-{unique_suffix}",
            name=f"Precision Test Supplier {unique_suffix}",
            opening_balance=0.0,
            current_balance=0.0,
            status="active",
        )
        product = Product(
            product_code=f"PROD-TEST-{unique_suffix}",
            name=f"Test White Eggs {unique_suffix}",
            unit="pcs",
            opening_stock=10000.0,
            current_stock=10000.0,
            opening_stock_unit_cost=10.0,
            selling_price=12.0,
            minimum_stock=10.0,
            status="active",
        )
        db.add(customer)
        db.add(supplier)
        db.add(product)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(supplier)
        await db.refresh(product)

        yield {
            "customer_id": customer.id,
            "supplier_id": supplier.id,
            "product_id": product.id,
        }


@pytest.mark.anyio
async def test_sale_total_price_mode_large_quantity_preservation(async_client, auth_headers, test_entities):
    """
    CRITICAL BUG TEST:
    Quantity = 1,989 eggs
    User manually enters Total Price = 21,860
    Unit Price is approximately 10.9904.
    Reconstructing Total as Quantity * Unit Price gives 21,859.91 (WRONG).
    Under total_price mode, exact 21,860 must be preserved across create, fetch, and update!
    """
    customer_id = test_entities["customer_id"]
    product_id = test_entities["product_id"]

    # 1. Create Sale in Mode B (total_price)
    create_payload = {
        "customer_id": customer_id,
        "discount_amount": 0,
        "tax_amount": 0,
        "paid_amount": 0,
        "items": [
            {
                "product_id": product_id,
                "quantity": 1989,
                "unit_price": 10.9904,
                "discount": 0,
                "total_price": 21860.0,
                "pricing_mode": "total_price",
            }
        ],
    }

    create_res = await async_client.post("/api/v1/sales", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201, f"Create sale failed: {create_res.text}"
    sale_data = create_res.json()["data"]

    sale_id = sale_data["id"]
    assert sale_data["subtotal"] == 21860.0
    assert sale_data["grand_total"] == 21860.0
    assert sale_data["due_amount"] == 21860.0
    assert sale_data["items"][0]["total_price"] == 21860.0
    assert sale_data["items"][0]["pricing_mode"] == "total_price"

    # 2. GET Sale to verify persistence
    get_res = await async_client.get(f"/api/v1/sales/{sale_id}", headers=auth_headers)
    assert get_res.status_code == 200
    fetched_data = get_res.json()["data"]
    assert fetched_data["subtotal"] == 21860.0
    assert fetched_data["grand_total"] == 21860.0
    assert fetched_data["items"][0]["total_price"] == 21860.0
    assert fetched_data["items"][0]["pricing_mode"] == "total_price"

    # 3. Update Sale without modifying items (simulates editing other fields or saving without changes)
    update_payload = {
        "customer_id": customer_id,
        "discount_amount": 0,
        "tax_amount": 0,
        "paid_amount": 0,
        "notes": "Updated notes without changing items",
        "items": [
            {
                "product_id": product_id,
                "quantity": fetched_data["items"][0]["quantity"],
                "unit_price": fetched_data["items"][0]["unit_price"],
                "discount": fetched_data["items"][0]["discount"],
                "total_price": fetched_data["items"][0]["total_price"],
                "pricing_mode": fetched_data["items"][0]["pricing_mode"],
            }
        ],
    }

    update_res = await async_client.put(f"/api/v1/sales/{sale_id}", json=update_payload, headers=auth_headers)
    assert update_res.status_code == 200, f"Update sale failed: {update_res.text}"
    updated_data = update_res.json()["data"]
    assert updated_data["subtotal"] == 21860.0
    assert updated_data["grand_total"] == 21860.0
    assert updated_data["items"][0]["total_price"] == 21860.0
    assert updated_data["items"][0]["pricing_mode"] == "total_price"

    # 4. Verify Customer Balance reflects exact 21,860
    cust_res = await async_client.get(f"/api/v1/customers/{customer_id}", headers=auth_headers)
    assert cust_res.status_code == 200
    assert cust_res.json()["data"]["current_balance"] == 21860.0


@pytest.mark.anyio
async def test_sale_unit_price_mode_authoritative(async_client, auth_headers, test_entities):
    """
    Test Mode A: User manually edits Unit Price:
    Quantity = 10, Unit Price = 11.6 -> Total Price = 116.0
    Quantity = 20, Unit Price = 4.75 -> Total Price = 95.0
    """
    customer_id = test_entities["customer_id"]
    product_id = test_entities["product_id"]

    # Scenario A1: 10 * 11.6 = 116.0
    payload_a1 = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 10,
                "unit_price": 11.6,
                "pricing_mode": "unit_price",
            }
        ],
    }
    res1 = await async_client.post("/api/v1/sales", json=payload_a1, headers=auth_headers)
    assert res1.status_code == 201
    data1 = res1.json()["data"]
    assert data1["subtotal"] == 116.0
    assert data1["items"][0]["total_price"] == 116.0
    assert data1["items"][0]["pricing_mode"] == "unit_price"

    # Scenario A2: 20 * 4.75 = 95.0
    payload_a2 = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 20,
                "unit_price": 4.75,
                "pricing_mode": "unit_price",
            }
        ],
    }
    res2 = await async_client.post("/api/v1/sales", json=payload_a2, headers=auth_headers)
    assert res2.status_code == 201
    data2 = res2.json()["data"]
    assert data2["subtotal"] == 95.0
    assert data2["items"][0]["total_price"] == 95.0
    assert data2["items"][0]["pricing_mode"] == "unit_price"


@pytest.mark.anyio
async def test_sale_total_price_mode_small_values(async_client, auth_headers, test_entities):
    """
    Test Mode B: Quantity = 10, Total Price = 47.50 -> Unit Price = 4.75
    """
    customer_id = test_entities["customer_id"]
    product_id = test_entities["product_id"]

    payload = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 10,
                "unit_price": 4.75,
                "total_price": 47.50,
                "pricing_mode": "total_price",
            }
        ],
    }
    res = await async_client.post("/api/v1/sales", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["subtotal"] == 47.50
    assert data["items"][0]["total_price"] == 47.50
    assert data["items"][0]["unit_price"] == 4.75
    assert data["items"][0]["pricing_mode"] == "total_price"


@pytest.mark.anyio
async def test_sale_quantity_change_in_total_mode_preserves_total(async_client, auth_headers, test_entities):
    """
    In Mode B (total_price), when quantity changes, Total Price remains authoritative.
    Unit Price is updated to Total Price / Quantity.
    """
    customer_id = test_entities["customer_id"]
    product_id = test_entities["product_id"]

    # Create initial: Qty 10, Total 100
    create_payload = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 10,
                "unit_price": 10.0,
                "total_price": 100.0,
                "pricing_mode": "total_price",
            }
        ],
    }
    create_res = await async_client.post("/api/v1/sales", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201
    sale_id = create_res.json()["data"]["id"]

    # Update: Qty changed to 20, Total Price preserved at 100.0, Unit Price recalculated to 5.0
    update_payload = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 20,
                "unit_price": 5.0,
                "total_price": 100.0,
                "pricing_mode": "total_price",
            }
        ],
    }
    update_res = await async_client.put(f"/api/v1/sales/{sale_id}", json=update_payload, headers=auth_headers)
    assert update_res.status_code == 200
    updated = update_res.json()["data"]
    assert updated["subtotal"] == 100.0
    assert updated["items"][0]["total_price"] == 100.0
    assert updated["items"][0]["unit_price"] == 5.0


@pytest.mark.anyio
async def test_purchase_total_price_mode_large_quantity_preservation(async_client, auth_headers, test_entities):
    """
    Verify Purchases also support exact Total Price preservation for large quantities:
    Quantity = 1,989, Total Price = 21,860.
    """
    supplier_id = test_entities["supplier_id"]
    product_id = test_entities["product_id"]

    create_payload = {
        "supplier_id": supplier_id,
        "discount_amount": 0,
        "tax_amount": 0,
        "paid_amount": 0,
        "items": [
            {
                "product_id": product_id,
                "quantity": 1989,
                "unit_price": 10.9904,
                "discount": 0,
                "total_price": 21860.0,
                "pricing_mode": "total_price",
            }
        ],
    }

    create_res = await async_client.post("/api/v1/purchases", json=create_payload, headers=auth_headers)
    assert create_res.status_code == 201, f"Create purchase failed: {create_res.text}"
    purchase_data = create_res.json()["data"]

    purchase_id = purchase_data["id"]
    assert purchase_data["subtotal"] == 21860.0
    assert purchase_data["grand_total"] == 21860.0
    assert purchase_data["due_amount"] == 21860.0
    assert purchase_data["items"][0]["total_price"] == 21860.0
    assert purchase_data["items"][0]["pricing_mode"] == "total_price"

    # GET Purchase
    get_res = await async_client.get(f"/api/v1/purchases/{purchase_id}", headers=auth_headers)
    assert get_res.status_code == 200
    fetched_data = get_res.json()["data"]
    assert fetched_data["subtotal"] == 21860.0
    assert fetched_data["items"][0]["total_price"] == 21860.0
    assert fetched_data["items"][0]["pricing_mode"] == "total_price"

    # Update Purchase without modifying items
    update_payload = {
        "supplier_id": supplier_id,
        "discount_amount": 0,
        "tax_amount": 0,
        "paid_amount": 0,
        "notes": "Updated purchase notes without changing items",
        "items": [
            {
                "product_id": product_id,
                "quantity": fetched_data["items"][0]["quantity"],
                "unit_price": fetched_data["items"][0]["unit_price"],
                "discount": fetched_data["items"][0]["discount"],
                "total_price": fetched_data["items"][0]["total_price"],
                "pricing_mode": fetched_data["items"][0]["pricing_mode"],
            }
        ],
    }
    update_res = await async_client.put(f"/api/v1/purchases/{purchase_id}", json=update_payload, headers=auth_headers)
    assert update_res.status_code == 200, f"Update purchase failed: {update_res.text}"
    updated_data = update_res.json()["data"]
    assert updated_data["subtotal"] == 21860.0
    assert updated_data["grand_total"] == 21860.0
    assert updated_data["items"][0]["total_price"] == 21860.0
    assert updated_data["items"][0]["pricing_mode"] == "total_price"

    # Verify Supplier balance reflects exact 21,860
    supp_res = await async_client.get(f"/api/v1/suppliers/{supplier_id}", headers=auth_headers)
    assert supp_res.status_code == 200
    assert supp_res.json()["data"]["current_balance"] == 21860.0


@pytest.mark.anyio
async def test_purchase_unit_price_mode_authoritative(async_client, auth_headers, test_entities):
    """
    Test Mode A for Purchases:
    Quantity = 10, Unit Price = 11.6 -> Total Price = 116.0
    """
    supplier_id = test_entities["supplier_id"]
    product_id = test_entities["product_id"]

    payload = {
        "supplier_id": supplier_id,
        "items": [
            {
                "product_id": product_id,
                "quantity": 10,
                "unit_price": 11.6,
                "pricing_mode": "unit_price",
            }
        ],
    }
    res = await async_client.post("/api/v1/purchases", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["subtotal"] == 116.0
    assert data["items"][0]["total_price"] == 116.0
    assert data["items"][0]["pricing_mode"] == "unit_price"
