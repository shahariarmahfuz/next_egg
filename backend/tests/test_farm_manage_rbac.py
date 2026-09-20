import pytest
from httpx import AsyncClient
from datetime import date
import uuid


def get_error_message(res) -> str:
    body = res.json()
    if isinstance(body, dict):
        if "error" in body and isinstance(body["error"], dict) and "message" in body["error"]:
            return body["error"]["message"]
        if "detail" in body:
            return str(body["detail"])
    return str(body)


@pytest.mark.asyncio
async def test_farm_manage_production_and_delivery_rbac(async_client: AsyncClient, auth_headers: dict):
    # Step 1: Retrieve all permissions and find Farm Production and Farm Delivery permission IDs
    res_perms = await async_client.get("/api/v1/permissions", headers=auth_headers)
    assert res_perms.status_code == 200
    perms_list = res_perms.json()["data"]

    def find_perm(code: str):
        p = next((x for x in perms_list if x["code"] == code), None)
        assert p is not None, f"Permission {code} not found in database"
        return p["id"]

    p_prod_view = find_perm("farm.production.view")
    p_prod_create = find_perm("farm.production.create")
    p_prod_edit = find_perm("farm.production.edit")
    p_prod_delete = find_perm("farm.production.delete")

    p_deliv_view = find_perm("farm.delivery.view")
    p_deliv_create = find_perm("farm.delivery.create")
    p_deliv_edit = find_perm("farm.delivery.edit")
    p_deliv_delete = find_perm("farm.delivery.delete")

    # Step 2: Create a dedicated test farm with 100 opening/previous trays
    unique_suffix = uuid.uuid4().hex[:6]
    res_farm = await async_client.post(
        "/api/v1/farm/farms",
        headers=auth_headers,
        json={
            "name": f"Test Farm {unique_suffix}",
            "code": f"TF_{unique_suffix}",
            "previous_tray": 100.0,
            "address": "Dhaka Farm Location",
        },
    )
    assert res_farm.status_code == 201
    farm_id = res_farm.json()["data"]["id"]

    # Helper function to create a test role, user, and get JWT token
    async def create_user_with_permissions(role_name: str, perm_ids: list[str]):
        suf = uuid.uuid4().hex[:6]
        role_code = f"r_{suf}"
        username = f"u_{suf}"
        password = "User@Password2026!"

        res_role = await async_client.post(
            "/api/v1/roles",
            headers=auth_headers,
            json={"name": f"{role_name} {suf}", "code": role_code, "description": f"Role for {role_name}"},
        )
        assert res_role.status_code == 201
        role_id = res_role.json()["data"]["id"]

        res_assign = await async_client.put(
            f"/api/v1/roles/{role_id}/permissions",
            headers=auth_headers,
            json={"permission_ids": perm_ids},
        )
        assert res_assign.status_code == 200

        res_user = await async_client.post(
            "/api/v1/users",
            headers=auth_headers,
            json={
                "username": username,
                "password": password,
                "full_name": f"Test {role_name}",
                "email": f"{username}@testfarm.com",
                "phone": f"018{suf[:8].ljust(8, '1')}",
                "role_id": role_id,
            },
        )
        assert res_user.status_code == 201

        res_login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": password},
        )
        assert res_login.status_code == 200
        token = res_login.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}

    # Setup specialized users:
    # 1. Full operator with all view, edit, delete on production & delivery
    headers_full_farm = await create_user_with_permissions(
        "FarmFull",
        [p_prod_view, p_prod_edit, p_prod_delete, p_deliv_view, p_deliv_edit, p_deliv_delete],
    )
    # 2. View-only user
    headers_view_only = await create_user_with_permissions(
        "FarmViewOnly",
        [p_prod_view, p_deliv_view],
    )
    # 3. User with no farm permissions
    headers_no_access = await create_user_with_permissions("FarmNoAccess", [])

    today_str = str(date.today())

    # ==========================================
    # PRODUCTION RBAC & STOCK INTEGRITY TESTS
    # ==========================================

    # Create a production entry of 50 trays as owner
    res_p1 = await async_client.post(
        "/api/v1/farm/production",
        headers=auth_headers,
        json={
            "farm_id": farm_id,
            "production_date": today_str,
            "tray_quantity": 50.0,
            "notes": "Initial test harvest",
        },
    )
    assert res_p1.status_code == 201
    prod_id = res_p1.json()["data"]["id"]

    # 1. View Production permissions
    # - User with farm.production.view can list and get
    res_list = await async_client.get(f"/api/v1/farm/production?farm_id={farm_id}", headers=headers_view_only)
    assert res_list.status_code == 200
    assert len(res_list.json()["data"]["items"]) >= 1

    res_single = await async_client.get(f"/api/v1/farm/production/{prod_id}", headers=headers_view_only)
    assert res_single.status_code == 200
    assert res_single.json()["data"]["tray_quantity"] == 50.0

    # - User without farm.production.view gets 403 Forbidden
    res_no_view = await async_client.get("/api/v1/farm/production", headers=headers_no_access)
    assert res_no_view.status_code == 403

    # - User with View only CANNOT Edit (gets 403 Forbidden)
    res_forbidden_edit = await async_client.put(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_view_only,
        json={"tray_quantity": 60.0},
    )
    assert res_forbidden_edit.status_code == 403

    # - User with View only CANNOT Delete (gets 403 Forbidden)
    res_forbidden_del = await async_client.delete(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_view_only,
    )
    assert res_forbidden_del.status_code == 403

    # 2. Edit Production permissions
    # - User with farm.production.edit can update
    res_edit_ok = await async_client.put(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_full_farm,
        json={"tray_quantity": 70.0, "notes": "Updated harvest notes"},
    )
    assert res_edit_ok.status_code == 200
    assert res_edit_ok.json()["data"]["tray_quantity"] == 70.0

    # Available balance is now: 100 (prev) + 70 (prod) = 170 trays.

    # 3. Stock Integrity: Deliver 150 trays so only 20 trays remain available
    res_d1 = await async_client.post(
        "/api/v1/farm/delivery",
        headers=auth_headers,
        json={
            "farm_id": farm_id,
            "delivery_date": today_str,
            "destination": "Central Depot",
            "tray_quantity": 150.0,
            "notes": "Large delivery",
        },
    )
    assert res_d1.status_code == 201
    deliv_id = res_d1.json()["data"]["id"]

    # Now available is 170 - 150 = 20 trays.
    # If we attempt to reduce production by 30 trays (e.g. to 40 trays), it must fail with 400!
    res_bad_edit = await async_client.put(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_full_farm,
        json={"tray_quantity": 40.0},
    )
    assert res_bad_edit.status_code == 400
    assert "Cannot reduce production quantity" in get_error_message(res_bad_edit)

    # If we attempt to delete production of 70 trays (when only 20 are available), it must fail with 400!
    res_bad_del = await async_client.delete(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_full_farm,
    )
    assert res_bad_del.status_code == 400
    assert "Cannot delete production" in get_error_message(res_bad_del)

    # ==========================================
    # DELIVERY RBAC & STOCK INTEGRITY TESTS
    # ==========================================

    # 1. View Delivery permissions
    # - User with farm.delivery.view can list and get
    res_d_list = await async_client.get(f"/api/v1/farm/delivery?farm_id={farm_id}", headers=headers_view_only)
    assert res_d_list.status_code == 200
    assert len(res_d_list.json()["data"]["items"]) >= 1

    res_d_single = await async_client.get(f"/api/v1/farm/delivery/{deliv_id}", headers=headers_view_only)
    assert res_d_single.status_code == 200
    assert res_d_single.json()["data"]["destination"] == "Central Depot"

    # - User without farm.delivery.view gets 403 Forbidden
    res_no_deliv_view = await async_client.get("/api/v1/farm/delivery", headers=headers_no_access)
    assert res_no_deliv_view.status_code == 403

    # - User with View only CANNOT Edit delivery (gets 403 Forbidden)
    res_deliv_forbid_edit = await async_client.put(
        f"/api/v1/farm/delivery/{deliv_id}",
        headers=headers_view_only,
        json={"destination": "Unauthorized Store"},
    )
    assert res_deliv_forbid_edit.status_code == 403

    # - User with View only CANNOT Delete delivery (gets 403 Forbidden)
    res_deliv_forbid_del = await async_client.delete(
        f"/api/v1/farm/delivery/{deliv_id}",
        headers=headers_view_only,
    )
    assert res_deliv_forbid_del.status_code == 403

    # 2. Edit Delivery permissions & Stock limit
    # - Increasing delivery from 150 by 30 trays (to 180) when only 20 trays are available must fail with 400!
    res_bad_deliv_inc = await async_client.put(
        f"/api/v1/farm/delivery/{deliv_id}",
        headers=headers_full_farm,
        json={"tray_quantity": 180.0},
    )
    assert res_bad_deliv_inc.status_code == 400
    assert "Insufficient trays available" in get_error_message(res_bad_deliv_inc)

    # - Editing destination and valid quantity (e.g. 160, increasing by 10 <= 20) succeeds
    res_deliv_edit_ok = await async_client.put(
        f"/api/v1/farm/delivery/{deliv_id}",
        headers=headers_full_farm,
        json={"destination": "Depot Express", "tray_quantity": 160.0},
    )
    assert res_deliv_edit_ok.status_code == 200
    assert res_deliv_edit_ok.json()["data"]["destination"] == "Depot Express"
    assert res_deliv_edit_ok.json()["data"]["tray_quantity"] == 160.0

    # 3. Delete Delivery permissions
    # - User with farm.delivery.delete can delete delivery
    res_deliv_del_ok = await async_client.delete(
        f"/api/v1/farm/delivery/{deliv_id}",
        headers=headers_full_farm,
    )
    assert res_deliv_del_ok.status_code == 200

    # Now that delivery of 160 was deleted, farm available balance is back to:
    # 100 (prev) + 70 (prod) - 0 (delivery) = 170 trays.
    # Now deleting production of 70 trays succeeds because remaining 100 trays >= 0!
    res_prod_del_ok = await async_client.delete(
        f"/api/v1/farm/production/{prod_id}",
        headers=headers_full_farm,
    )
    assert res_prod_del_ok.status_code == 200
