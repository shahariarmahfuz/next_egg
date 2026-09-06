from sqlalchemy import Column, String, Float, Date, ForeignKey, Integer, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel
import enum
from datetime import date

class FarmTransactionType(str, enum.Enum):
    PRODUCTION = "PRODUCTION"
    DELIVERY = "DELIVERY"
    WASTE = "WASTE"

class FarmTransaction(TimestampedBaseModel):
    __tablename__ = "farm_transactions"

    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True, nullable=False)
    transaction_type: Mapped[FarmTransactionType] = mapped_column(String(20), index=True, nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    
    tray_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    units_per_tray: Mapped[float | None] = mapped_column(Float, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    
    destination: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product", backref="farm_transactions")

    @property
    def note(self) -> str | None:
        return self.notes

    @note.setter
    def note(self, value: str | None) -> None:
        self.notes = value
