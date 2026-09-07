from datetime import date
from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class FarmProduction(TimestampedBaseModel):
    """
    Farm Production entity representing a daily production harvest of trays.
    """
    __tablename__ = "farm_productions"

    farm_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    production_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    tray_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    farm = relationship("Farm", back_populates="productions")
