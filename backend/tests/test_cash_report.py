import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from decimal import Decimal
from app.main import app
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from sqlalchemy import select


@pytest.mark.asyncio
async def test_cash_report_endpoint_and_calculations():
    async with AsyncSessionLocal() as session:
        # Find active user with admin/owner role (has cash_report.view permission)
        user_res = await session.execute(
            select(User).join(User.role).where(User.status == "active", Role.code.in_(["owner", "admin"]))
        )
        user = user_res.scalars().first()
        if not user:
            user_res = await session.execute(select(User).where(User.status == "active"))
            user = user_res.scalars().first()
        assert user is not None, "Active user required for auth test"

    token = create_access_token(subject=user.id)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Test fetching cash report for a specific target date
        response = await client.get(
            "/api/v1/reports/cash-report?target_date=2026-11-08",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["success"] is True
        report = data["data"]

        assert report["target_date"] == "2026-11-08"
        assert report["start_date"] == "2026-11-08"
        assert report["end_date"] == "2026-11-08"
        assert "cash_sales_amount" in report
        assert "customer_collections_amount" in report
        assert "total_cash_in" in report
        assert "cash_out_amount" in report
        assert "expenses_amount" in report
        assert "total_cash_out" in report
        assert "remaining_cash" in report
        assert "breakdown" in report

        # Verify mathematical consistency
        cash_in_calc = round(report["cash_sales_amount"] + report["customer_collections_amount"], 2)
        assert abs(report["total_cash_in"] - cash_in_calc) < 0.01

        cash_out_calc = round(report["cash_out_amount"] + report["expenses_amount"], 2)
        assert abs(report["total_cash_out"] - cash_out_calc) < 0.01

        remaining_calc = round(report["total_cash_in"] - report["total_cash_out"], 2)
        assert abs(report["remaining_cash"] - remaining_calc) < 0.01

        # Check breakdown lists
        breakdown = report["breakdown"]
        assert isinstance(breakdown["cash_sales"], list)
        assert isinstance(breakdown["customer_collections"], list)
        assert isinstance(breakdown["cash_outs"], list)
        assert isinstance(breakdown["expenses"], list)

        # 2. Test date range query
        range_resp = await client.get(
            "/api/v1/reports/cash-report?start_date=2026-11-01&end_date=2026-11-10",
            headers=headers,
        )
        assert range_resp.status_code == 200, range_resp.text
        range_data = range_resp.json()["data"]
        assert range_data["start_date"] == "2026-11-01"
        assert range_data["end_date"] == "2026-11-10"
        assert range_data["target_date"] == "2026-11-01 to 2026-11-10"


@pytest.mark.asyncio
async def test_cash_report_rbac():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Unauthenticated request must return 401
        res_no_auth = await client.get("/api/v1/reports/cash-report")
        assert res_no_auth.status_code in [401, 403]
