from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel

class InventoryBatch(TimestampedBaseModel):
    """
    Inventory Batch Entity.
    """
    __tablename__ = "inventory_batches"

    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purchase_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=True, index=True
    )
    
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    remaining_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False)
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    # Relationships
    product = relationship("Product", lazy="selectin")
    purchase = relationship("Purchase", lazy="selectin")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_batch_quantity_positive"),
        CheckConstraint("remaining_quantity >= 0", name="chk_batch_rem_quantity_non_negative"),
        CheckConstraint("unit_cost >= 0", name="chk_batch_unit_cost_positive"),
        Index("idx_batch_product_date", "product_id", "purchase_date"),
    )
