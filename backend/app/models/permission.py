from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampedBaseModel


class Permission(TimestampedBaseModel):
    """
    Permission Entity representing system capabilities.
    """
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    module: Mapped[str] = mapped_column(
        String(50), index=True, nullable=False
    )  # sales, customer, product, supplier, reports, user, role
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    roles: Mapped[list["Role"]] = relationship(
        "Role", secondary="role_permissions", back_populates="permissions"
    )

    __table_args__ = (
        Index("idx_permission_code", "code"),
        Index("idx_permission_module", "module"),
    )
