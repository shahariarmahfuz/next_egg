from datetime import date
from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class FarmEntry(TimestampedBaseModel):
    """
    Farm Daily / Transaction Entry.
    Contains:
    - farm_id
    - date
    - production_trays
    - notes
    - deliveries (relationship to FarmDelivery)
    """
    __tablename__ = "farm_entries"

    farm_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    production_trays: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    farm = relationship("Farm", back_populates="entries")
    deliveries = relationship("FarmDelivery", back_populates="entry", cascade="all, delete-orphan")
