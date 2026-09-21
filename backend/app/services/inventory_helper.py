import json
from typing import Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.inventory_batch import InventoryBatch
from app.models.product import Product
from app.models.purchase import Purchase, PurchaseItem
from app.models.sale import SaleItem


async def get_last_purchase_cost(db: AsyncSession, product: Product) -> float:
    """
    Returns the product's last known purchase rate / last purchase cost.
    Priority:
    1. Most recent PurchaseItem with unit_price > 0 (associated with a Purchase).
    2. Most recent InventoryBatch with unit_cost > 0.
    3. Product opening_stock_unit_cost if > 0.
    4. 0.0 fallback if no historical purchase cost exists.
    """
    # 1. Most recent purchase line item
    q_purchase = (
        select(PurchaseItem.unit_price)
        .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
        .where(PurchaseItem.product_id == product.id, PurchaseItem.unit_price > 0)
        .order_by(Purchase.purchase_date.desc(), PurchaseItem.created_at.desc())
        .limit(1)
    )
    res_purchase = await db.execute(q_purchase)
    last_purchase_price = res_purchase.scalar()
    if last_purchase_price is not None and last_purchase_price > 0:
        return float(last_purchase_price)

    # 2. Most recent inventory batch
    q_batch = (
        select(InventoryBatch.unit_cost)
        .where(InventoryBatch.product_id == product.id, InventoryBatch.unit_cost > 0)
        .order_by(InventoryBatch.purchase_date.desc(), InventoryBatch.created_at.desc())
        .limit(1)
    )
    res_batch = await db.execute(q_batch)
    last_batch_cost = res_batch.scalar()
    if last_batch_cost is not None and last_batch_cost > 0:
        return float(last_batch_cost)

    # 3. Product opening stock unit cost
    if product.opening_stock_unit_cost and product.opening_stock_unit_cost > 0:
        return float(product.opening_stock_unit_cost)

    return 0.0


async def record_uncovered_sale_item(
    db: AsyncSession,
    user_id: Optional[str],
    sale_id: str,
    sale_item_id: str,
    product_id: str,
    uncovered_quantity: float,
    provisional_unit_cost: float,
) -> None:
    """
    Records an activity audit log tracking an uncovered (negative stock) sale item portion.
    """
    if uncovered_quantity <= 0:
        return
    log_entry = ActivityLog(
        user_id=user_id,
        action="UNCOVERED_SALE_ITEM",
        entity_type="SaleItem",
        entity_id=sale_item_id,
        payload=json.dumps({
            "product_id": product_id,
            "sale_id": sale_id,
            "uncovered_quantity": float(uncovered_quantity),
            "provisional_unit_cost": float(provisional_unit_cost),
            "reconciled_quantity": 0.0,
        }),
    )
    db.add(log_entry)


async def reconcile_uncovered_sales_for_batch(
    db: AsyncSession, batch: InventoryBatch
) -> float:
    """
    Reconciles previously uncovered negative-stock sales with the newly received InventoryBatch.
    In FIFO order, finds sales that occurred when stock was negative/insufficient,
    updates their SaleItem.cogs from provisional cost to the actual batch unit_cost,
    and consumes the appropriate quantity from the batch.
    """
    if batch.remaining_quantity <= 0:
        return 0.0

    q = (
        select(ActivityLog)
        .where(
            ActivityLog.entity_type == "SaleItem",
            ActivityLog.action == "UNCOVERED_SALE_ITEM",
        )
        .order_by(ActivityLog.created_at.asc())
    )
    res = await db.execute(q)
    logs = res.scalars().all()

    total_reconciled = 0.0

    for log_entry in logs:
        if batch.remaining_quantity <= 0:
            break
        try:
            data = json.loads(log_entry.payload or "{}")
        except Exception:
            continue

        if data.get("product_id") != batch.product_id:
            continue

        uncovered_qty = float(data.get("uncovered_quantity", 0.0))
        reconciled_qty = float(data.get("reconciled_quantity", 0.0))
        remaining_uncovered = uncovered_qty - reconciled_qty

        if remaining_uncovered <= 0:
            log_entry.action = "RECONCILED_SALE_ITEM"
            db.add(log_entry)
            continue

        qty_to_reconcile = min(batch.remaining_quantity, remaining_uncovered)
        batch.remaining_quantity -= qty_to_reconcile
        db.add(batch)

        sale_item = await db.get(SaleItem, log_entry.entity_id)
        if sale_item:
            provisional_rate = float(data.get("provisional_unit_cost", 0.0))
            actual_rate = float(batch.unit_cost)
            cost_adjustment = (qty_to_reconcile * actual_rate) - (qty_to_reconcile * provisional_rate)
            sale_item.cogs = round(sale_item.cogs + cost_adjustment, 4)
            db.add(sale_item)

        new_reconciled = reconciled_qty + qty_to_reconcile
        data["reconciled_quantity"] = new_reconciled
        if new_reconciled >= uncovered_qty:
            log_entry.action = "RECONCILED_SALE_ITEM"
        log_entry.payload = json.dumps(data)
        db.add(log_entry)

        total_reconciled += qty_to_reconcile

    return total_reconciled


async def remove_uncovered_sale_logs(
    db: AsyncSession, sale_item_ids: list[str]
) -> None:
    """Removes uncovered sale logs when sale items are reverted or deleted."""
    if not sale_item_ids:
        return
    stmt = delete(ActivityLog).where(
        ActivityLog.entity_type == "SaleItem",
        ActivityLog.entity_id.in_(sale_item_ids),
        ActivityLog.action.in_(["UNCOVERED_SALE_ITEM", "RECONCILED_SALE_ITEM"]),
    )
    await db.execute(stmt)
