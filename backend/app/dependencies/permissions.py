from typing import List, Union
from fastapi import Depends
from app.dependencies.auth import get_current_user
from app.exceptions.custom import ForbiddenException
from app.models.user import User


class RequirePermission:
    """
    Permission Enforcement Middleware Dependency.
    Example Usage:
        @router.post("/sales", dependencies=[Depends(RequirePermission("sales.create"))])
        @router.get("/reports", dependencies=[Depends(RequirePermission(["reports.view", "sales.view"]))])
    """

    def __init__(self, permissions: Union[str, List[str]]):
        if isinstance(permissions, str):
            self.required_permissions = [permissions]
        else:
            self.required_permissions = permissions

    async def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        # Owner, Admin, and Super Admin roles bypass all permission checks
        if current_user.role and current_user.role.code in ["owner", "admin", "super_admin"]:
            return current_user

        if not current_user.role or not current_user.role.permissions:
            raise ForbiddenException(
                f"Access denied. Missing required permission: {', '.join(self.required_permissions)}"
            )

        user_permission_codes = {p.code for p in current_user.role.permissions}

        # Check if user has at least one of the required permissions (or all if strict)
        has_permission = any(perm in user_permission_codes for perm in self.required_permissions)

        if not has_permission:
            raise ForbiddenException(
                f"Permission denied. Required permission: {', '.join(self.required_permissions)}"
            )

        return current_user
