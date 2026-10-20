import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.inventory_batch import InventoryBatch
from app.models.supplier import Supplier
from app.schemas.purchase import PurchaseCreate, PurchaseUpdate, PurchaseItemCreate
from app.services.purchase_service import purchase_service
from app.exceptions.custom import BadRequestException, NotFoundException


@pytest.mark.asyncio
async def test_1_reduce_quantity_existing_purchase():
    """1. Edit an existing purchase and reduce quantity."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE pi.quantity > 5.0 AND ib.remaining_quantity >= 5.0
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No suitable purchase found in test database"
        purchase_id, prod_id, initial_stock, old_qty, unit_price, old_rem = row

        reduce_by = 3.0
        new_qty = old_qty - reduce_by

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=unit_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert len(updated.items) == 1
        assert updated.items[0].quantity == new_qty

        # Verify product stock decreased by exactly reduce_by
        res_prod = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_prod.scalar()
        assert abs(new_stock - (initial_stock - reduce_by)) < 1e-4

        # Verify batch remaining_quantity decreased by reduce_by
        res_batch = await session.execute(text(f"SELECT quantity, remaining_quantity FROM inventory_batches WHERE purchase_id = '{purchase_id}';"))
        b_qty, b_rem = res_batch.fetchone()
        assert abs(b_qty - new_qty) < 1e-4
        assert abs(b_rem - (old_rem - reduce_by)) < 1e-4
        assert b_rem >= 0
        assert b_qty >= b_rem

        await session.rollback()


@pytest.mark.asyncio
async def test_2_increase_quantity_existing_purchase():
    """2. Edit an existing purchase and increase quantity."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No suitable purchase found in test database"
        purchase_id, prod_id, initial_stock, old_qty, unit_price, old_rem = row

        increase_by = 7.0
        new_qty = old_qty + increase_by

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=unit_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert len(updated.items) == 1
        assert updated.items[0].quantity == new_qty

        # Verify product stock increased by exactly increase_by
        res_prod = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_prod.scalar()
        assert abs(new_stock - (initial_stock + increase_by)) < 1e-4

        # Verify batch quantity increased by increase_by
        res_batch = await session.execute(text(f"SELECT quantity, remaining_quantity FROM inventory_batches WHERE purchase_id = '{purchase_id}';"))
        b_qty, b_rem = res_batch.fetchone()
        assert abs(b_qty - new_qty) < 1e-4
        assert abs(b_rem - (old_rem + increase_by)) < 1e-4
        assert b_rem >= 0
        assert b_qty >= b_rem

        await session.rollback()


@pytest.mark.asyncio
async def test_3_edit_purchase_with_negative_stock_product():
    """3. Edit a purchase where the product currently has negative stock."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.name, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE p.current_stock < 0 AND ib.remaining_quantity >= 5.0
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No purchase with negative stock product found in test database"
        purchase_id, prod_id, prod_name, initial_stock, old_qty, unit_price, old_rem = row
        assert initial_stock < 0, f"Product {prod_name} expected to have negative stock"

        reduce_by = 4.0
        new_qty = old_qty - reduce_by

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=unit_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated is not None

        res_prod = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_prod.scalar()
        assert abs(new_stock - (initial_stock - reduce_by)) < 1e-4
        assert new_stock < initial_stock

        await session.rollback()


@pytest.mark.asyncio
async def test_4_edit_purchase_with_positive_stock_product():
    """4. Edit a purchase where the product has positive stock."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.name, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE p.current_stock > 100.0 AND ib.remaining_quantity >= 5.0
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No purchase with positive stock product found in test database"
        purchase_id, prod_id, prod_name, initial_stock, old_qty, unit_price, old_rem = row
        assert initial_stock > 0

        reduce_by = 2.0
        new_qty = old_qty - reduce_by

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=unit_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated is not None

        res_prod = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_prod.scalar()
        assert abs(new_stock - (initial_stock - reduce_by)) < 1e-4

        await session.rollback()


@pytest.mark.asyncio
async def test_5_edit_multiple_purchase_items():
    """5. Edit multiple purchase items."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, count(pi.id) as item_count
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity >= 2.0
            GROUP BY pu.id
            HAVING count(pi.id) >= 2
            LIMIT 1;
        """))
        row = res.fetchone()
        created_temp = False
        if row is None:
            # Dynamically create a 2-item purchase for testing
            res_supp = await session.execute(text("SELECT id FROM suppliers LIMIT 1;"))
            supp_id = res_supp.scalar()
            res_prods = await session.execute(text("SELECT id FROM products WHERE product_type = 'NORMAL' LIMIT 2;"))
            p_rows = res_prods.fetchall()
            assert len(p_rows) >= 2, "Need at least 2 products to test multi-item purchase edit"
            prod1, prod2 = p_rows[0][0], p_rows[1][0]
            res_user = await session.execute(text("SELECT id FROM users LIMIT 1;"))
            user_id = res_user.scalar()

            p_in = PurchaseCreate(
                supplier_id=supp_id,
                items=[
                    PurchaseItemCreate(product_id=prod1, quantity=10.0, unit_price=5.0),
                    PurchaseItemCreate(product_id=prod2, quantity=10.0, unit_price=6.0),
                ],
                paid_amount=110.0,
            )
            created_pu = await purchase_service.create_purchase(session, user_id=user_id, purchase_in=p_in)
            purchase_id = created_pu.id
            created_temp = True
        else:
            purchase_id, item_count = row

        res_items = await session.execute(text(f"""
            SELECT pi.product_id, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchase_items pi
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pi.purchase_id AND ib.product_id = pi.product_id
            WHERE pi.purchase_id = '{purchase_id}';
        """))
        items = res_items.fetchall()
        assert len(items) >= 2

        new_items_in = []
        expected_stocks = {}

        for prod_id, cur_stock, old_qty, u_price, rem_qty in items:
            new_qty = old_qty - 1.0
            new_items_in.append(
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=u_price,
                )
            )
            expected_stocks[prod_id] = cur_stock - 1.0

        update_data = PurchaseUpdate(items=new_items_in)
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert len(updated.items) == len(new_items_in)

        for prod_id, exp_stock in expected_stocks.items():
            res_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
            actual_stock = res_stock.scalar()
            assert abs(actual_stock - exp_stock) < 1e-4

        if created_temp:
            await purchase_service.delete_purchase(session, purchase_id)
            await session.commit()
        else:
            await session.rollback()


@pytest.mark.asyncio
async def test_6_edit_purchase_duplicate_product_ids():
    """6. Edit a purchase submitting duplicate product IDs across lines."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price, ib.quantity as b_qty, ib.remaining_quantity as b_rem
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity < ib.quantity
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No batch with consumed units found in test database"
        purchase_id, prod_id, initial_stock, old_qty, unit_price, b_qty, b_rem = row
        consumed = b_qty - b_rem
        assert consumed > 0

        # Submit 2 lines of the same product
        line1_qty = consumed + 2.0
        line2_qty = 5.0
        total_new_qty = line1_qty + line2_qty

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(product_id=prod_id, quantity=line1_qty, unit_price=unit_price),
                PurchaseItemCreate(product_id=prod_id, quantity=line2_qty, unit_price=unit_price),
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert len(updated.items) == 2

        # Check product stock: net_delta = total_new_qty - old_qty
        res_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_stock.scalar()
        expected_stock = initial_stock + (total_new_qty - old_qty)
        assert abs(new_stock - expected_stock) < 1e-4

        # Check batches: total remaining must be total_new_qty - consumed
        res_batches = await session.execute(text(f"SELECT quantity, remaining_quantity FROM inventory_batches WHERE purchase_id = '{purchase_id}';"))
        batches = res_batches.fetchall()
        assert len(batches) == 2
        total_batch_qty = sum(b[0] for b in batches)
        total_batch_rem = sum(b[1] for b in batches)

        assert abs(total_batch_qty - total_new_qty) < 1e-4
        assert abs(total_batch_rem - (total_new_qty - consumed)) < 1e-4
        for b_q, b_r in batches:
            assert b_r >= 0
            assert b_q >= b_r

        await session.rollback()


@pytest.mark.asyncio
async def test_7_add_and_remove_purchase_items():
    """7. Add a new product item and remove an existing product item."""
    async with AsyncSessionLocal() as session:
        # Find a purchase with an unconsumed batch
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity = ib.quantity
            LIMIT 1;
        """))
        row = res.fetchone()
        purchase_id, old_prod_id, old_prod_stock, old_qty, unit_price = row

        # Find a different product in the DB to add
        res_diff = await session.execute(text(f"""
            SELECT id, current_stock FROM products
            WHERE id != '{old_prod_id}' AND product_type != 'FARM'
            LIMIT 1;
        """))
        new_prod_id, new_prod_stock = res_diff.fetchone()

        new_item_qty = 12.0
        new_item_price = 15.0

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=new_prod_id,
                    quantity=new_item_qty,
                    unit_price=new_item_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert len(updated.items) == 1
        assert updated.items[0].product_id == new_prod_id

        # Verify old product stock reverted by -old_qty
        res_old_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{old_prod_id}';"))
        assert abs(res_old_stock.scalar() - (old_prod_stock - old_qty)) < 1e-4

        # Verify new product stock increased by +new_item_qty
        res_new_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{new_prod_id}';"))
        assert abs(res_new_stock.scalar() - (new_prod_stock + new_item_qty)) < 1e-4

        # Verify old batch deleted and new batch created
        res_batches = await session.execute(text(f"SELECT product_id, quantity, remaining_quantity FROM inventory_batches WHERE purchase_id = '{purchase_id}';"))
        current_batches = res_batches.fetchall()
        assert len(current_batches) == 1
        assert current_batches[0][0] == new_prod_id
        assert current_batches[0][1] == new_item_qty
        assert current_batches[0][2] == new_item_qty

        await session.rollback()


@pytest.mark.asyncio
async def test_8_change_purchase_date():
    """8. Change purchase date and verify InventoryBatch purchase_date updates."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, pu.purchase_date
            FROM purchases pu
            LIMIT 1;
        """))
        purchase_id, old_date = res.fetchone()

        new_date = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        update_data = PurchaseUpdate(purchase_date=new_date)

        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated.purchase_date == new_date

        res_batches = await session.execute(text(f"SELECT purchase_date FROM inventory_batches WHERE purchase_id = '{purchase_id}';"))
        for (b_date,) in res_batches.fetchall():
            assert b_date == new_date

        await session.rollback()


@pytest.mark.asyncio
async def test_9_change_price_discount_tax_paid_and_supplier():
    """9. Change price, discount, tax, paid amount, and switch supplier."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, pu.supplier_id, pu.due_amount, pi.product_id, pi.quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            LIMIT 1;
        """))
        purchase_id, old_supp_id, old_due, prod_id, qty = res.fetchone()

        # Find another supplier
        res_supp = await session.execute(text(f"SELECT id, current_balance FROM suppliers WHERE id != '{old_supp_id}' LIMIT 1;"))
        new_supp_id, new_supp_initial_balance = res_supp.fetchone()

        res_old_supp = await session.execute(text(f"SELECT current_balance FROM suppliers WHERE id = '{old_supp_id}';"))
        old_supp_initial_balance = res_old_supp.scalar()

        new_unit_price = 25.0
        new_discount = 10.0
        new_tax = 5.0
        new_paid = 50.0

        subtotal = qty * new_unit_price
        expected_grand_total = max(0.0, subtotal - new_discount + new_tax)
        expected_due = max(0.0, expected_grand_total - new_paid)

        update_data = PurchaseUpdate(
            supplier_id=new_supp_id,
            discount_amount=new_discount,
            tax_amount=new_tax,
            paid_amount=new_paid,
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=qty,
                    unit_price=new_unit_price,
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated.supplier_id == new_supp_id
        assert abs(updated.subtotal - subtotal) < 1e-4
        assert abs(updated.grand_total - expected_grand_total) < 1e-4
        assert abs(updated.due_amount - expected_due) < 1e-4

        # Verify old supplier balance decreased by old_due
        res_old_balance = await session.execute(text(f"SELECT current_balance FROM suppliers WHERE id = '{old_supp_id}';"))
        assert abs(res_old_balance.scalar() - (old_supp_initial_balance - old_due)) < 1e-4

        # Verify new supplier balance increased by expected_due
        res_new_balance = await session.execute(text(f"SELECT current_balance FROM suppliers WHERE id = '{new_supp_id}';"))
        assert abs(res_new_balance.scalar() - (new_supp_initial_balance + expected_due)) < 1e-4

        await session.rollback()


@pytest.mark.asyncio
async def test_10_verify_fifo_cost_layer_protection():
    """10. Verify FIFO/cost-layer consistency: cannot reduce quantity below consumed units."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.name, pi.unit_price, ib.quantity, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity < ib.quantity
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No batch with consumed units found in test database"
        purchase_id, prod_id, prod_name, unit_price, b_qty, b_rem = row
        consumed = b_qty - b_rem
        assert consumed > 0

        forbidden_qty = max(0.1, consumed - 1.0)
        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=forbidden_qty,
                    unit_price=unit_price,
                )
            ]
        )

        with pytest.raises(BadRequestException) as exc_info:
            await purchase_service.update_purchase(session, purchase_id, update_data)

        assert "already been sold/consumed in sales" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_11_verify_rollback_on_error():
    """11. Verify atomic rollback when a genuine error occurs."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price, pu.due_amount, s.id as supp_id, s.current_balance
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN suppliers s ON s.id = pu.supplier_id
            LIMIT 1;
        """))
        purchase_id, prod_id, initial_stock, old_qty, unit_price, old_due, supp_id, supp_balance = res.fetchone()

        invalid_prod_id = "00000000-0000-0000-0000-000000000000"
        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=invalid_prod_id,
                    quantity=50.0,
                    unit_price=unit_price,
                )
            ]
        )

        with pytest.raises(NotFoundException):
            await purchase_service.update_purchase(session, purchase_id, update_data)

        await session.rollback()

        res_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        assert abs(res_stock.scalar() - initial_stock) < 1e-4

        res_pu = await session.execute(text(f"SELECT due_amount FROM purchases WHERE id = '{purchase_id}';"))
        assert abs(res_pu.scalar() - old_due) < 1e-4

        res_supp = await session.execute(text(f"SELECT current_balance FROM suppliers WHERE id = '{supp_id}';"))
        assert abs(res_supp.scalar() - supp_balance) < 1e-4


@pytest.mark.asyncio
async def test_12_api_endpoint_purchase_update(async_client, auth_headers):
    """12. Test HTTP PUT /api/v1/purchases/{purchase_id} endpoint directly."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity, pi.unit_price, ib.remaining_quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE p.current_stock < 0 AND ib.remaining_quantity >= 5.0
            LIMIT 1;
        """))
        purchase_id, prod_id, initial_stock, old_qty, unit_price, old_rem = res.fetchone()

    new_qty = old_qty - 2.0
    payload = {
        "items": [
            {
                "product_id": prod_id,
                "quantity": new_qty,
                "unit_price": unit_price,
            }
        ]
    }
    response = await async_client.put(
        f"/api/v1/purchases/{purchase_id}",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 200, f"API Update failed: {response.text}"
    body = response.json()
    assert body["success"] is True
    assert len(body["data"]["items"]) == 1
    assert body["data"]["items"][0]["quantity"] == new_qty

    async with AsyncSessionLocal() as session:
        res_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        updated_stock = res_stock.scalar()
        assert abs(updated_stock - (initial_stock - 2.0)) < 1e-4

        # Revert back via API to maintain clean DB state
        revert_payload = {
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": old_qty,
                    "unit_price": unit_price,
                }
            ]
        }
        revert_res = await async_client.put(
            f"/api/v1/purchases/{purchase_id}",
            json=revert_payload,
            headers=auth_headers,
        )
        assert revert_res.status_code == 200


@pytest.mark.asyncio
async def test_13_delete_purchase_negative_stock():
    """13. Verify delete_purchase succeeds even when product stock is negative."""
    async with AsyncSessionLocal() as session:
        # Dynamically find a purchase with unconsumed batches for a negative stock product
        res = await session.execute(text("""
            SELECT pu.id, p.id as prod_id, p.current_stock, pi.quantity
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN products p ON p.id = pi.product_id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE p.current_stock < 0 AND ib.remaining_quantity = ib.quantity
            LIMIT 1;
        """))
        row = res.fetchone()
        assert row is not None, "No purchase found with unconsumed batch for negative stock product"
        purchase_id, prod_id, cur_stock, item_qty = row

        # Calling delete_purchase should succeed without negative-stock rejection
        deleted = await purchase_service.delete_purchase(session, purchase_id)
        assert deleted is True

        # Product stock should decrease by item_qty
        res_stock = await session.execute(text(f"SELECT current_stock FROM products WHERE id = '{prod_id}';"))
        new_stock = res_stock.scalar()
        assert abs(new_stock - (cur_stock - item_qty)) < 1e-4

        # Always rollback in test
        await session.rollback()


@pytest.mark.asyncio
async def test_14_total_price_mode_unit_cost_derivation():
    """14. In total_price mode, unit cost must be derived from total_price / qty even if unit_price > 0."""
    async with AsyncSessionLocal() as session:
        # Find a purchase with an unconsumed batch
        res = await session.execute(text("""
            SELECT pu.id, pi.product_id, pi.quantity, pi.unit_price
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity = ib.quantity
            LIMIT 1;
        """))
        purchase_id, prod_id, old_qty, old_price = res.fetchone()

        new_qty = 100.0
        bulk_total = 800.0  # effective unit rate = 8.0
        accidental_tray_price = 240.0  # e.g., 240/tray passed in unit_price field

        update_data = PurchaseUpdate(
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=new_qty,
                    unit_price=accidental_tray_price,
                    total_price=bulk_total,
                    pricing_mode="total_price",
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated is not None

        # Verify batch unit_cost is 8.0, NOT overridden by 240.0
        res_batch = await session.execute(text(f"""
            SELECT unit_cost, quantity, remaining_quantity 
            FROM inventory_batches 
            WHERE purchase_id = '{purchase_id}' AND product_id = '{prod_id}';
        """))
        b_cost, b_qty, b_rem = res_batch.fetchone()
        assert abs(b_cost - 8.0) < 1e-4, f"Expected unit_cost 8.0, got {b_cost}"

        await session.rollback()


@pytest.mark.asyncio
async def test_15_proportional_order_level_discount_batch_cost():
    """15. Order-level discount must be distributed proportionally into batch unit_cost."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT pu.id, pi.product_id
            FROM purchases pu
            JOIN purchase_items pi ON pi.purchase_id = pu.id
            JOIN inventory_batches ib ON ib.purchase_id = pu.id AND ib.product_id = pi.product_id
            WHERE ib.remaining_quantity = ib.quantity
            LIMIT 1;
        """))
        purchase_id, prod_id = res.fetchone()

        # 100 units @ 10.0 = 1000.0 subtotal. Order discount = 200.0.
        # Net landing cost = (1000 - 200) / 100 = 8.0 per unit.
        update_data = PurchaseUpdate(
            discount_amount=200.0,
            items=[
                PurchaseItemCreate(
                    product_id=prod_id,
                    quantity=100.0,
                    unit_price=10.0,
                    total_price=1000.0,
                    pricing_mode="unit_price",
                )
            ]
        )
        updated = await purchase_service.update_purchase(session, purchase_id, update_data)
        assert updated is not None
        assert abs(updated.grand_total - 800.0) < 1e-4

        res_batch = await session.execute(text(f"""
            SELECT unit_cost FROM inventory_batches 
            WHERE purchase_id = '{purchase_id}' AND product_id = '{prod_id}';
        """))
        b_cost = res_batch.scalar()
        assert abs(b_cost - 8.0) < 1e-4, f"Expected effective batch unit_cost 8.0, got {b_cost}"

        await session.rollback()


@pytest.mark.asyncio
async def test_16_retroactive_cogs_update_on_purchase_edit():
    """16. When purchase unit price is edited, already-consumed units must have SaleItem.cogs retroactively updated."""
    import uuid
    from app.schemas.sale import SaleCreate, SaleItemCreate
    from app.services.sale_service import sale_service
    from app.models.product import Product

    async with AsyncSessionLocal() as session:
        # Create a dedicated isolated product with 0 stock so FIFO starts strictly with our test batch
        code = f"TEST-RETRO-{uuid.uuid4().hex[:6]}"
        test_prod = Product(
            product_code=code,
            name=f"Retro Test Product {code}",
            unit="pcs",
            product_type="NORMAL",
            current_stock=0.0,
            opening_stock=0.0,
            opening_stock_unit_cost=0.0,
            selling_price=15.0,
            status="active",
        )
        session.add(test_prod)
        await session.commit()
        await session.refresh(test_prod)
        prod_id = test_prod.id

        res_supp = await session.execute(text("SELECT id FROM suppliers LIMIT 1;"))
        supp_id = res_supp.scalar()
        res_cust = await session.execute(text("SELECT id FROM customers LIMIT 1;"))
        cust_id = res_cust.scalar()
        res_user = await session.execute(text("SELECT id FROM users LIMIT 1;"))
        user_id = res_user.scalar()

        try:
            # 1. Create a fresh purchase: 50 units @ 10.0
            p_in = PurchaseCreate(
                supplier_id=supp_id,
                items=[PurchaseItemCreate(product_id=prod_id, quantity=50.0, unit_price=10.0)],
                paid_amount=500.0,
            )
            purchase = await purchase_service.create_purchase(session, user_id=user_id, purchase_in=p_in)

            # 2. Sell 20 units @ 15.0 -> initial COGS should be 20 * 10 = 200.0
            s_in = SaleCreate(
                customer_id=cust_id,
                items=[SaleItemCreate(product_id=prod_id, quantity=20.0, unit_price=15.0)],
                paid_amount=300.0,
            )
            sale = await sale_service.create_sale(session, user_id=user_id, sale_in=s_in)
            assert len(sale.items) == 1
            sale_item_id = sale.items[0].id
            initial_cogs = sale.items[0].cogs

            # Check batch remaining is 30, consumed is 20
            res_batch = await session.execute(text(f"SELECT quantity, remaining_quantity, unit_cost FROM inventory_batches WHERE purchase_id = '{purchase.id}';"))
            b_qty, b_rem, b_cost = res_batch.fetchone()
            assert abs(b_rem - 30.0) < 1e-4

            # 3. Edit purchase: change unit_price from 10.0 to 7.0
            # Expected new COGS for the 20 consumed units = 20 * 7.0 = 140.0 (reduction of 60.0)
            p_up = PurchaseUpdate(
                supplier_id=supp_id,
                items=[PurchaseItemCreate(product_id=prod_id, quantity=50.0, unit_price=7.0)],
                paid_amount=350.0,
            )
            updated_pu = await purchase_service.update_purchase(session, purchase.id, p_up)
            assert updated_pu is not None

            # Verify sale_item.cogs was retroactively updated to reflect 7.0/unit
            res_si = await session.execute(text(f"SELECT cogs FROM sale_items WHERE id = '{sale_item_id}';"))
            updated_cogs = res_si.scalar()
            expected_cogs = initial_cogs - (20.0 * (10.0 - 7.0))
            assert abs(updated_cogs - expected_cogs) < 1e-4, f"Expected retroactive COGS {expected_cogs}, got {updated_cogs}"

            # Clean up created sale & purchase
            await sale_service.delete_sale(session, sale.id)
            await purchase_service.delete_purchase(session, purchase.id)
            await session.commit()
        finally:
            await session.execute(text(f"DELETE FROM products WHERE id = '{prod_id}';"))
            await session.commit()


