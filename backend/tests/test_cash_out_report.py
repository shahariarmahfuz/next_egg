import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from app.main import app
from app.models.user import User
from app.models.role import Role
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from sqlalchemy import select


@pytest.mark.asyncio
async def test_cash_out_report_endpoint():
    async with AsyncSessionLocal() as session:
        # Find active user with admin/owner role (has cash_out_report.view permission)
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
        # 1. Test fetching cash out report with date range
        response = await client.get(
            "/api/v1/reports/cash-out?start_date=2026-01-01&end_date=2026-12-31",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["success"] is True
        report = data["data"]

        assert "summary" in report
        assert "reasons_breakdown" in report
        assert "items" in report
        assert "total_count" in report
        assert "start_date" in report
        assert "end_date" in report

        summary = report["summary"]
        assert "total_cash_outs" in summary
        assert "total_amount" in summary
        assert "average_amount" in summary

        # 2. Test search filter
        search_resp = await client.get(
            "/api/v1/reports/cash-out?start_date=2026-01-01&end_date=2026-12-31&search=test",
            headers=headers,
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["success"] is True
