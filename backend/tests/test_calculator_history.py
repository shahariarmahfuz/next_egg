import uuid
from datetime import datetime, timedelta, timezone
import zoneinfo
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_calculator_history_per_user_and_date_filters(
    async_client: AsyncClient, auth_headers: dict
):
    tz = zoneinfo.ZoneInfo("Asia/Dhaka")
    now_dhaka = datetime.now(tz)
    today_str = now_dhaka.date().isoformat()
    yesterday_dt = (now_dhaka - timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
    yesterday_str = yesterday_dt.date().isoformat()

    # 1. Create today's entry for owner
    res_today = await async_client.post(
        "/api/v1/calculators/history",
        headers=auth_headers,
        json={
            "calculator_type": "egg",
            "calculation_date": now_dhaka.astimezone(timezone.utc).isoformat(),
            "product_name": "লাল ডিম",
            "eggs_per_tray": 30,
            "stacks": [{"id": "1", "traysPerStack": 20, "stacksCount": 5}],
            "loose_entries": {"good": [15], "cracked": [], "broken": [], "spoiled": []},
            "next_day_sell": 0,
            "total_trays": 100,
            "total_tray_eggs": 3000,
            "total_loose_eggs": 15,
            "next_day_sell_eggs": 0,
            "grand_total_eggs": 3015,
            "full_trays": 100,
            "remainder_eggs": 15,
        },
    )
    assert res_today.status_code == 201
    today_id = res_today.json()["data"]["id"]

    # 2. Create yesterday's entry for owner
    res_yesterday = await async_client.post(
        "/api/v1/calculators/history",
        headers=auth_headers,
        json={
            "calculator_type": "egg",
            "calculation_date": yesterday_dt.astimezone(timezone.utc).isoformat(),
            "product_name": "সাদা ডিম",
            "eggs_per_tray": 30,
            "stacks": [{"id": "1", "traysPerStack": 20, "stacksCount": 2}],
            "loose_entries": {"good": [], "cracked": [], "broken": [], "spoiled": []},
            "next_day_sell": 0,
            "total_trays": 40,
            "total_tray_eggs": 1200,
            "total_loose_eggs": 0,
            "next_day_sell_eggs": 0,
            "grand_total_eggs": 1200,
            "full_trays": 40,
            "remainder_eggs": 0,
        },
    )
    assert res_yesterday.status_code == 201
    yesterday_id = res_yesterday.json()["data"]["id"]

    # 3. Default GET returns daily (today) only
    res_daily = await async_client.get(
        "/api/v1/calculators/history", headers=auth_headers, params={"timezone": "Asia/Dhaka"}
    )
    assert res_daily.status_code == 200
    daily_ids = {item["id"] for item in res_daily.json()["data"]["items"]}
    assert today_id in daily_ids
    assert yesterday_id not in daily_ids

    # 4. Date filter for yesterday returns yesterday's entry
    res_yest_filter = await async_client.get(
        "/api/v1/calculators/history",
        headers=auth_headers,
        params={"target_date": yesterday_str, "timezone": "Asia/Dhaka"},
    )
    assert res_yest_filter.status_code == 200
    yest_ids = {item["id"] for item in res_yest_filter.json()["data"]["items"]}
    assert yesterday_id in yest_ids
    assert today_id not in yest_ids

    # 5. show_all=true returns both
    res_all = await async_client.get(
        "/api/v1/calculators/history",
        headers=auth_headers,
        params={"show_all": True, "timezone": "Asia/Dhaka"},
    )
    assert res_all.status_code == 200
    all_ids = {item["id"] for item in res_all.json()["data"]["items"]}
    assert {today_id, yesterday_id}.issubset(all_ids)

    # 6. Per-user isolation: another user with calculator.view cannot see or delete owner's history
    roles_res = await async_client.get("/api/v1/roles", headers=auth_headers)
    emp_role = next(r for r in roles_res.json()["data"] if r["code"] == "employee")
    suffix = uuid.uuid4().hex[:6]
    username = f"calc_{suffix}"
    password = "Calc@User2026!"
    u_res = await async_client.post(
        "/api/v1/users",
        headers=auth_headers,
        json={
            "username": username,
            "full_name": "Calc Test Employee",
            "password": password,
            "role_id": emp_role["id"],
            "status": "active",
        },
    )
    assert u_res.status_code in (200, 201)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "remember_me": False},
    )
    assert login_res.status_code == 200
    emp_headers = {"Authorization": f"Bearer {login_res.json()['data']['access_token']}"}

    emp_list = await async_client.get(
        "/api/v1/calculators/history",
        headers=emp_headers,
        params={"show_all": True, "timezone": "Asia/Dhaka"},
    )
    assert emp_list.status_code == 200
    assert emp_list.json()["data"]["items"] == []

    # Employee cannot delete owner's history item
    emp_del = await async_client.delete(
        f"/api/v1/calculators/history/{today_id}", headers=emp_headers
    )
    assert emp_del.status_code == 404

    # Cleanup owner's test records for today/yesterday
    del_today = await async_client.delete(
        f"/api/v1/calculators/history/{today_id}", headers=auth_headers
    )
    assert del_today.status_code == 200
    del_yest = await async_client.delete(
        f"/api/v1/calculators/history/{yesterday_id}", headers=auth_headers
    )
    assert del_yest.status_code == 200
    assert today_str != yesterday_str
