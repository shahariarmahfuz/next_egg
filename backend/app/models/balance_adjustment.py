from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedBaseModel


class BalanceAdjustment(TimestampedBaseModel):
    """
    Immutable Balance Adjustment audit record for Customers and Suppliers.
    """
    __tablename__ = "balance_adjustments"

    entity_type: Mapped[str] = mapped_column(String(20), index=True, nullable=False)  # "customer" | "supplier"
    entity_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

    previous_balance: Mapped[float] = mapped_column(Float, nullable=False)
    new_balance: Mapped[float] = mapped_column(Float, nullable=False)
    difference: Mapped[float] = mapped_column(Float, nullable=False)

    balance_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "customer_due", "customer_advance", "supplier_payable", "supplier_advance"
    effective_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(150), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    created_by_user_name: Mapped[str] = mapped_column(String(150), nullable=False)

    __table_args__ = (
        Index("idx_adj_entity", "entity_type", "entity_id"),
        Index("idx_adj_created_at", "created_at"),
    )
