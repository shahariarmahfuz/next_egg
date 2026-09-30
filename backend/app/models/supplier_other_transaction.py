from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class SupplierOtherTransaction(TimestampedBaseModel):
    """
    Supplier Other Transaction Entity (e.g. Other Payable: money received from supplier outside purchases).
    """
    __tablename__ = "supplier_other_transactions"

    voucher_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    transaction_type: Mapped[str] = mapped_column(
        String(50), default="other_payable", nullable=False, index=True
    )  # e.g., 'other_payable'
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_sot_amount_positive"),
        Index("idx_sot_voucher_no", "voucher_no"),
        Index("idx_sot_supplier", "supplier_id"),
        Index("idx_sot_date", "transaction_date"),
    )
