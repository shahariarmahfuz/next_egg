from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel
from app.models.user import User


class CashOut(TimestampedBaseModel):
    """
    Cash Out Voucher Entity.
    Physical cash taken OUT of the cash balance for non-expense reasons
    (e.g., Owner/Proprietor cash withdrawal, Personal withdrawal, Cash transfer out).
    Reduces Cash Book balance as a CASH OUT transaction.
    Does NOT affect Total Expense, Profit, Customer Due, Supplier Due, or Inventory.
    """
    __tablename__ = "cash_outs"

    cash_out_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    cash_out_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    created_by: Mapped["User"] = relationship("User", lazy="selectin")

    @property
    def note(self) -> str | None:
        return self.notes

    @note.setter
    def note(self, value: str | None) -> None:
        self.notes = value

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_cash_out_amount_positive"),
        Index("idx_cash_out_date", "cash_out_date"),
        Index("idx_cash_out_no", "cash_out_no"),
    )
