import pytest
import uuid
from datetime import date, timedelta


@pytest.mark.asyncio
async def test_expense_aggregate_and_pagination(async_client, auth_headers):
    # 1. Fetch expenses list
    res = await async_client.get("/api/v1/expenses?page=1&page_size=1", headers=auth_headers)
    assert res.status_code == 200, f"Failed: {res.text}"
    body = res.json()
    assert body["success"] is True
    data = body["data"]

    # Verify aggregate exists and is computed over all matching records
    assert "aggregate" in data
    assert data["aggregate"] is not None
    assert "total_amount" in data["aggregate"]
    assert isinstance(data["aggregate"]["total_amount"], (int, float))

    total_records = data["total"]
    if total_records > 1:
        # Since page_size=1, only 1 item is returned in items
        assert len(data["items"]) == 1
        # But aggregate.total_amount is the sum of ALL records, not just this 1 item
        item_amount = data["items"][0]["amount"]
        total_aggregate = data["aggregate"]["total_amount"]
        assert total_aggregate >= item_amount


@pytest.mark.asyncio
async def test_farm_report_daily_tray_calculation(async_client, auth_headers):
    unique_suffix = uuid.uuid4().hex[:6]
    farm_code = f"TFR-{unique_suffix}".upper()
    farm_name = f"Test Farm Report {unique_suffix}"

    # 1. Create a test farm with opening previous_tray = 100.0
    farm_payload = {
        "name": farm_name,
        "code": farm_code,
        "previous_tray": 100.0,
        "notes": "Testing daily tray calculation",
    }
    farm_res = await async_client.post("/api/v1/farm/farms", json=farm_payload, headers=auth_headers)
    assert farm_res.status_code == 201, f"Failed to create farm: {farm_res.text}"
    farm_id = farm_res.json()["data"]["id"]

    base_date = date(2026, 1, 10)
    day1 = (base_date).isoformat()
    day2 = (base_date + timedelta(days=1)).isoformat()
    day3 = (base_date + timedelta(days=2)).isoformat()

    try:
        # Day 1:
        # Record production = 50 trays
        prod1_res = await async_client.post(
            "/api/v1/farm/production",
            json={
                "farm_id": farm_id,
                "production_date": day1,
                "tray_quantity": 50.0,
                "notes": "Day 1 harvest",
            },
            headers=auth_headers,
        )
        assert prod1_res.status_code == 201

        # Record delivery = 20 trays
        deliv1_res = await async_client.post(
            "/api/v1/farm/delivery",
            json={
                "farm_id": farm_id,
                "delivery_date": day1,
                "destination": "Main Depot",
                "tray_quantity": 20.0,
                "notes": "Day 1 dispatch",
            },
            headers=auth_headers,
        )
        assert deliv1_res.status_code == 201

        # Check Day 1 Report:
        # Previous Left Tray: 100.0 (opening)
        # Production: 50.0
        # Delivery: 20.0
        # Left Tray: 130.0 (100 + 50 - 20)
        rep1_res = await async_client.get(
            f"/api/v1/farm/report?farm_id={farm_id}&start_date={day1}&end_date={day1}",
            headers=auth_headers,
        )
        assert rep1_res.status_code == 200
        kpis1 = rep1_res.json()["data"]["kpis"]
        assert kpis1["previous_left_tray"] == 100.0
        assert kpis1["total_production"] == 50.0
        assert kpis1["total_delivered"] == 20.0
        assert kpis1["left_tray"] == 130.0

        # Day 2:
        # Record production = 80 trays
        prod2_res = await async_client.post(
            "/api/v1/farm/production",
            json={
                "farm_id": farm_id,
                "production_date": day2,
                "tray_quantity": 80.0,
                "notes": "Day 2 harvest",
            },
            headers=auth_headers,
        )
        assert prod2_res.status_code == 201

        # Record delivery = 50 trays
        deliv2_res = await async_client.post(
            "/api/v1/farm/delivery",
            json={
                "farm_id": farm_id,
                "delivery_date": day2,
                "destination": "Market Store",
                "tray_quantity": 50.0,
                "notes": "Day 2 dispatch",
            },
            headers=auth_headers,
        )
        assert deliv2_res.status_code == 201

        # Check Day 2 Report:
        # Previous Left Tray: 130.0 (exact Day 1 closing balance!)
        # Production: 80.0
        # Delivery: 50.0
        # Left Tray: 160.0 (130 + 80 - 50)
        rep2_res = await async_client.get(
            f"/api/v1/farm/report?farm_id={farm_id}&start_date={day2}&end_date={day2}",
            headers=auth_headers,
        )
        assert rep2_res.status_code == 200
        kpis2 = rep2_res.json()["data"]["kpis"]
        assert kpis2["previous_left_tray"] == 130.0
        assert kpis2["total_production"] == 80.0
        assert kpis2["total_delivered"] == 50.0
        assert kpis2["left_tray"] == 160.0

        # Day 3:
        # No production, record delivery = 30 trays
        deliv3_res = await async_client.post(
            "/api/v1/farm/delivery",
            json={
                "farm_id": farm_id,
                "delivery_date": day3,
                "destination": "Depot 2",
                "tray_quantity": 30.0,
                "notes": "Day 3 dispatch",
            },
            headers=auth_headers,
        )
        assert deliv3_res.status_code == 201

        # Check Day 3 Report:
        # Previous Left Tray: 160.0
        # Production: 0.0
        # Delivery: 30.0
        # Left Tray: 130.0 (160 + 0 - 30)
        rep3_res = await async_client.get(
            f"/api/v1/farm/report?farm_id={farm_id}&start_date={day3}&end_date={day3}",
            headers=auth_headers,
        )
        assert rep3_res.status_code == 200
        kpis3 = rep3_res.json()["data"]["kpis"]
        assert kpis3["previous_left_tray"] == 160.0
        assert kpis3["total_production"] == 0.0
        assert kpis3["total_delivered"] == 30.0
        assert kpis3["left_tray"] == 130.0

    finally:
        # Cleanup farm and its cascade entries/prods/delivs
        await async_client.delete(f"/api/v1/farm/farms/{farm_id}", headers=auth_headers)
