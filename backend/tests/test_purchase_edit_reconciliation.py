import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.inventory_batch import InventoryBatch
from app.models.supplier import Supplier
from app.schemas.purchase import PurchaseUpdate, PurchaseItemCreate
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
        assert row is not None, "No multi-item purchase found in test database"
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

