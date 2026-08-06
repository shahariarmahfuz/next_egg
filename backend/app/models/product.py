from sqlalchemy import CheckConstraint, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedBaseModel


class Product(TimestampedBaseModel):
    """
    Product Entity.
    """
    __tablename__ = "products"

    product_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)

    opening_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    opening_stock_unit_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    selling_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    minimum_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default="active", index=True, nullable=False
    )  # active, inactive
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("current_stock >= 0", name="chk_product_stock_non_negative"),
        CheckConstraint("opening_stock_unit_cost >= 0", name="chk_product_opening_cost_positive"),
        CheckConstraint("selling_price >= 0", name="chk_product_selling_price_positive"),
        Index("idx_product_status_name", "status", "name"),
        Index("idx_product_category", "category"),
        Index("idx_product_brand", "brand"),
        Index("idx_product_barcode", "barcode"),
    )
