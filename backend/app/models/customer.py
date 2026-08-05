from sqlalchemy import Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedBaseModel


class Customer(TimestampedBaseModel):
    """
    Customer Entity.
    """
    __tablename__ = "customers"

    customer_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), unique=False, index=True, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    nid: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    credit_limit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_customer_code", "customer_code"),
        Index("idx_customer_name", "name"),
        Index("idx_customer_phone", "phone"),
        Index("idx_customer_balance", "current_balance"),
    )
