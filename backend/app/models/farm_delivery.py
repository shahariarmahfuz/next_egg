from datetime import date
from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class FarmDelivery(TimestampedBaseModel):
    """
    Farm Delivery entity representing dispatches/transfers of trays to destinations.
    Can be associated with a FarmEntry or Farm.
    """
    __tablename__ = "farm_deliveries"

    farm_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("farm_entries.id", ondelete="CASCADE"), nullable=True, index=True
    )
    delivery_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    tray_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    farm = relationship("Farm", back_populates="deliveries")
    entry = relationship("FarmEntry", back_populates="deliveries")
