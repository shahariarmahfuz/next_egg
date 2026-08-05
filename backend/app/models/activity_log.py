from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class ActivityLog(TimestampedBaseModel):
    """
    Activity Audit Log Entity.
    """
    __tablename__ = "activity_logs"

    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User | None"] = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("idx_log_user_action", "user_id", "action"),
        Index("idx_log_entity", "entity_type", "entity_id"),
        Index("idx_log_created", "created_at"),
    )
