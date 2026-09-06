from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.db import get_db
from app.dependencies.permissions import RequirePermission
from app.models.user import User
from app.schemas.common import ResponseModel

router = APIRouter(prefix="/reports", tags=["Reports Center"])


@router.get("", response_model=ResponseModel[dict])
@router.get("/overview", response_model=ResponseModel[dict])
async def get_reports_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("reports.view")),
):
    """Reports Center overview endpoint protected by reports.view permission."""
    return ResponseModel[dict](
        success=True,
        message="Reports Center access verified",
        data={
            "modules": [
                "sales",
                "sale_return",
                "purchase",
                "product_return",
                "customer_collection",
                "supplier_payment",
            ],
            "access": "granted",
        },
    )
