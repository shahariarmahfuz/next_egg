from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel
from app.models.user import User


class ExpenseCategory(TimestampedBaseModel):
    """
    Expense Category Entity (e.g., Office Rent, Electricity Bill, Employee Salary).
    """
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True, nullable=False)

    # Relationships
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="category")


class Expense(TimestampedBaseModel):
    """
    Expense Voucher Entity.
    """
    __tablename__ = "expenses"

    voucher_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("expense_categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    expense_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    payment_method: Mapped[str] = mapped_column(String(50), default="Cash", index=True, nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Relationships
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="expenses", lazy="selectin")
    created_by: Mapped["User"] = relationship("User", lazy="selectin")
