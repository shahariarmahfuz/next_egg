from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class SupplierPayment(TimestampedBaseModel):
    """
    Supplier Payment Voucher Entity.
    """
    __tablename__ = "supplier_payments"

    payment_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    purchase_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)  # cash, bank_transfer, cheque, card
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", lazy="selectin")
    purchase: Mapped["Purchase | None"] = relationship("Purchase", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_spay_amount_positive"),
        Index("idx_spay_no", "payment_no"),
        Index("idx_spay_supplier", "supplier_id"),
        Index("idx_spay_purchase", "purchase_id"),
    )
