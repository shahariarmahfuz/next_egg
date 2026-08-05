from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class SaleReturn(TimestampedBaseModel):
    """
    Sale Return (Customer Return Header) Entity.
    """
    __tablename__ = "sale_returns"

    return_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    sale_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sales.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    customer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    
    return_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", lazy="selectin")
    sale: Mapped["Sale | None"] = relationship("Sale", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")
    items: Mapped[list["SaleReturnItem"]] = relationship(
        "SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_sret_no", "return_no"),
        Index("idx_sret_customer", "customer_id"),
        Index("idx_sret_sale", "sale_id"),
    )


class SaleReturnItem(TimestampedBaseModel):
    """
    Sale Return Line Item Entity.
    """
    __tablename__ = "sale_return_items"

    sale_return_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sale_returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    sale_return: Mapped["SaleReturn"] = relationship("SaleReturn", back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="selectin")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_sret_item_qty_positive"),
        CheckConstraint("unit_price >= 0", name="chk_sret_item_price_positive"),
        CheckConstraint("total_price >= 0", name="chk_sret_item_total_positive"),
        Index("idx_sret_item_return", "sale_return_id"),
        Index("idx_sret_item_product", "product_id"),
    )
