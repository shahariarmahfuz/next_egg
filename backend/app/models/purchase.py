from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class Purchase(TimestampedBaseModel):
    """
    Purchase Order / Header Entity.
    """
    __tablename__ = "purchases"

    purchase_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    invoice_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    supplier_id: Mapped[str] = mapped_column(String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    due_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", lazy="selectin")
    user: Mapped["User"] = relationship("User", lazy="selectin")
    items: Mapped[list["PurchaseItem"]] = relationship(
        "PurchaseItem", back_populates="purchase", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("idx_purchase_no", "purchase_no"),
        Index("idx_purchase_supplier_date", "supplier_id", "purchase_date"),
    )


class PurchaseItem(TimestampedBaseModel):
    """
    Purchase Line Item Entity.
    """
    __tablename__ = "purchase_items"

    purchase_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="selectin")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_purchase_item_qty_positive"),
        CheckConstraint("unit_price >= 0", name="chk_purchase_item_price_positive"),
        CheckConstraint("total_price >= 0", name="chk_purchase_item_total_positive"),
        Index("idx_purchase_item_purchase", "purchase_id"),
        Index("idx_purchase_item_product", "product_id"),
    )
