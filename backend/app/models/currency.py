from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedBaseModel

class Currency(TimestampedBaseModel):
    """
    Currency Master Entity.
    """
    __tablename__ = "currencies"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    symbol_position: Mapped[str] = mapped_column(String(20), default="before", nullable=False) # 'before' or 'after'
    decimal_places: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
