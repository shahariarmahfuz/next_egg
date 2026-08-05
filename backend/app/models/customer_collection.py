from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class CustomerCollection(TimestampedBaseModel):
    """
    Customer Collection Voucher Entity.
    """
    __tablename__ = "customer_collections"

    collection_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    sale_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sales.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)  # cash, bank_transfer, cheque, card
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    collection_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", lazy="selectin")
    sale: Mapped["Sale | None"] = relationship("Sale", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")

    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_col_amount_positive"),
        Index("idx_col_no", "collection_no"),
        Index("idx_col_customer", "customer_id"),
        Index("idx_col_sale", "sale_id"),
    )
