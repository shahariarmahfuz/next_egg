from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel
from app.models.user import User


class CalculatorHistory(TimestampedBaseModel):
    """
    Per-user saved calculation history for business calculators (e.g. Egg Calculator).
    Each row belongs to a specific user (`user_id`) and stores the calculation breakdown
    alongside `calculation_date` for daily and date-range filtering.
    """

    __tablename__ = "calculator_histories"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    calculator_type: Mapped[str] = mapped_column(
        String(50), default="egg", nullable=False, index=True
    )
    calculation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    product_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    system_stock: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eggs_per_tray: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    stacks: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    loose_entries: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    next_day_sell: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_trays: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tray_eggs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_loose_eggs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_day_sell_eggs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total_eggs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    full_trays: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    remainder_eggs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stock_difference: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    user: Mapped["User"] = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("idx_calc_history_user_date", "user_id", "calculation_date", "is_deleted"),
    )
