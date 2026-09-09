from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class User(TimestampedBaseModel):
    """
    User Entity.
    """
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    profile_logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    role_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True
    )  # active, inactive, suspended

    recovery_mode_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=sa.text("false")
    )
    recovery_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recovery_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", lazy="selectin", foreign_keys=[role_id])
    roles: Mapped[list["Role"]] = relationship("Role", secondary="user_roles", back_populates="users", lazy="selectin")

    __table_args__ = (
        Index("idx_user_username", "username"),
        Index("idx_user_email", "email"),
        Index("idx_user_status_role", "status", "role_id"),
    )
