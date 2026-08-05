import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.0 Base Class for all database models.
    """
    pass


class TimestampedBaseModel(Base):
    """
    Abstract base model providing standard audit fields:
    - id (UUID v4 string)
    - created_at
    - updated_at
    - is_deleted (for soft delete support)
    """
    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    def dict(self) -> dict[str, Any]:
        """Convert model attributes to dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
