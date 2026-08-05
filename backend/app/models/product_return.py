from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class ProductReturn(TimestampedBaseModel):
    """
    Product Return (Supplier Return Header) Entity.
    """
    __tablename__ = "product_returns"

    return_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    purchase_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    
    return_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    refund_received: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", lazy="selectin")
    purchase: Mapped["Purchase | None"] = relationship("Purchase", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")
    items: Mapped[list["ProductReturnItem"]] = relationship(
        "ProductReturnItem", back_populates="product_return", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_pret_no", "return_no"),
        Index("idx_pret_supplier", "supplier_id"),
        Index("idx_pret_purchase", "purchase_id"),
    )


class ProductReturnItem(TimestampedBaseModel):
    """
    Product Return Line Item Entity.
    """
    __tablename__ = "product_return_items"

    product_return_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    product_return: Mapped["ProductReturn"] = relationship("ProductReturn", back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="selectin")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_pret_item_qty_positive"),
        CheckConstraint("unit_price >= 0", name="chk_pret_item_price_positive"),
        CheckConstraint("total_price >= 0", name="chk_pret_item_total_positive"),
        Index("idx_pret_item_return", "product_return_id"),
        Index("idx_pret_item_product", "product_id"),
    )
