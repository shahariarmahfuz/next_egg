from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import TimestampedBaseModel


class Setting(TimestampedBaseModel):
    """
    System Settings Entity.
    """
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    group_name: Mapped[str] = mapped_column(String(50), default="general", index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_settings_key", "key"),
        Index("idx_settings_group", "group_name"),
    )
