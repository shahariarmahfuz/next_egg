from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class Farm(TimestampedBaseModel):
    """
    Farm entity representing a physical or operational farm location.
    Tracks previous tray balance as opening stock.
    """
    __tablename__ = "farms"

    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    previous_tray: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    entries = relationship("FarmEntry", back_populates="farm", cascade="all, delete-orphan")
    productions = relationship("FarmProduction", back_populates="farm", cascade="all, delete-orphan")
    deliveries = relationship("FarmDelivery", back_populates="farm", cascade="all, delete-orphan")
