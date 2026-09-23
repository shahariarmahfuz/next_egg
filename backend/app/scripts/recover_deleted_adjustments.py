"""
Script to recover historical deleted balance adjustment records from immutable activity_logs.

IMPORTANT:
- Marks recovered records with is_history_deleted = True so they do NOT reappear in the UI Adjustment History tab.
- They will be included in Supplier Ledger and Customer Ledger accounting transactions and running due calculations.
- CRITICAL: DOES NOT modify or double-count supplier.current_balance or customer.current_balance!

Usage:
    python recover_deleted_adjustments.py --dry-run
    python recover_deleted_adjustments.py --apply
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.activity_log import ActivityLog
from app.models.balance_adjustment import BalanceAdjustment

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def recover_deleted_adjustments(apply: bool = False):
    logger.info("Starting Balance Adjustment Recovery Audit...")
    logger.info(f"Mode: {'APPLY CHANGES' if apply else 'DRY RUN (Preview Only)'}")

    async with AsyncSessionLocal() as db:
        # Fetch all adjustment delete activity logs
        query = (
            select(ActivityLog)
            .where(
                ActivityLog.action.in_([
                    "supplier.balance.adjustment.delete",
                    "customer.balance.adjustment.delete",
                ])
            )
            .order_by(ActivityLog.created_at.asc())
        )
        res = await db.execute(query)
        logs = res.scalars().all()

        logger.info(f"Found {len(logs)} adjustment deletion activity log entries.")

        recovered_count = 0
        skipped_count = 0
        supplier_count = 0
        customer_count = 0
        recovered_items = []

        try:
            for log in logs:
                payload = json.loads(log.payload) if isinstance(log.payload, str) else log.payload
                adj_id = payload.get("adjustment_id")
                if not adj_id:
                    continue

                entity_type = "supplier" if "supplier" in log.action else "customer"
                entity_id = payload.get("supplier_id") or payload.get("customer_id")
                diff = payload.get("difference", 0.0)
                prev_bal = payload.get("previous_balance", 0.0)
                new_bal = payload.get("new_balance", 0.0)
                reason = payload.get("reason", "Physical account reconciliation")

                # Check if already present in balance_adjustments
                existing = await db.get(BalanceAdjustment, adj_id)
                if existing:
                    logger.info(f"Adjustment {adj_id} already exists in DB. Skipping.")
                    skipped_count += 1
                    continue

                # Determine balance_type
                if entity_type == "supplier":
                    bal_type = "supplier_payable" if new_bal >= 0 else "supplier_advance"
                    supplier_count += 1
                else:
                    bal_type = "customer_due" if new_bal >= 0 else "customer_advance"
                    customer_count += 1

                recovered_adj = BalanceAdjustment(
                    id=adj_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    previous_balance=prev_bal,
                    new_balance=new_bal,
                    difference=diff,
                    balance_type=bal_type,
                    effective_date=log.created_at or datetime.now(timezone.utc),
                    reason=reason,
                    notes="Recovered from activity_logs audit trail (history_deleted=True)",
                    created_by_user_id=log.user_id or "system",
                    created_by_user_name="System Audit Recovery",
                    is_history_deleted=True,
                )

                recovered_items.append({
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "adjustment_id": adj_id,
                    "diff": diff,
                    "prev": prev_bal,
                    "new": new_bal,
                    "reason": reason,
                    "log_date": str(log.created_at)
                })

                if apply:
                    db.add(recovered_adj)

                recovered_count += 1

            # Print detailed manifest of recovered items
            print("\n" + "="*80)
            print(f"RECOVERY MANIFEST ({'APPLY' if apply else 'DRY RUN'}):")
            print("="*80)
            for idx, item in enumerate(recovered_items, 1):
                print(f"[{idx:02d}] {item['entity_type'].upper():8s} | Adj ID: {item['adjustment_id']} | Entity ID: {item['entity_id']} | Diff: {item['diff']:+12.2f} | Prev -> New: {item['prev']:10.2f} -> {item['new']:10.2f} | Date: {item['log_date']}")
            print("="*80)
            print("RECOVERY COUNTS BREAKDOWN:")
            print(f"  supplier: {supplier_count}")
            print(f"  customer: {customer_count}")
            print(f"  total:    {recovered_count}")
            print(f"  skipped:  {skipped_count}")
            print("="*80 + "\n")

            if apply:
                # Commit recovered adjustments WITHOUT altering current_balance
                await db.commit()
                logger.info(f"SUCCESS: Applied recovery of {recovered_count} adjustment ledger records.")
            else:
                logger.info(f"DRY RUN COMPLETE: {recovered_count} records to recover, {skipped_count} already present.")

        except Exception as e:
            if apply:
                await db.rollback()
            logger.error(f"Error during recovery transaction, all changes rolled back: {str(e)}")
            raise


def main():
    parser = argparse.ArgumentParser(description="Recover deleted balance adjustments from activity logs.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB.")
    args = parser.parse_args()

    asyncio.run(recover_deleted_adjustments(apply=args.apply))


if __name__ == "__main__":
    main()
