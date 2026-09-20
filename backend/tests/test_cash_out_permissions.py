import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
import uuid

@pytest.mark.asyncio
async def test_cash_out_permissions_matrix_and_rbac_scenarios(async_client: AsyncClient, auth_headers: dict):
    # Step 1: Verify permissions endpoint returns exactly the 3 Cash Out permissions
    res_perms = await async_client.get("/api/v1/permissions", headers=auth_headers)
    assert res_perms.status_code == 200
    perms_list = res_perms.json()["data"]
    
    co_perms = [p for p in perms_list if p["module"] == "cash_out"]
    co_codes = {p["code"] for p in co_perms}
    assert "cash_out.view" in co_codes
    assert "cash_out.edit" in co_codes
    assert "cash_out.delete" in co_codes
    # Verify no unexpected permissions like cash_out.create or cash_out.report exist
    assert "cash_out.create" not in co_codes
    assert "cash_out.report" not in co_codes
    assert "cash_out.export" not in co_codes
    assert "cash_out.manage" not in co_codes

    perm_id_view = next(p["id"] for p in co_perms if p["code"] == "cash_out.view")
    perm_id_edit = next(p["id"] for p in co_perms if p["code"] == "cash_out.edit")
    perm_id_delete = next(p["id"] for p in co_perms if p["code"] == "cash_out.delete")

    # Step 2: Create a sample Cash Out voucher as owner to test against
    test_date = datetime.now(timezone.utc).isoformat()
    res_co = await async_client.post(
        "/api/v1/accounts/cash-out",
        headers=auth_headers,
        json={
            "amount": 1000.0,
            "cash_out_date": test_date,
            "reason": "Permission Test Voucher",
            "notes": "Testing RBAC matrix",
        },
    )
    assert res_co.status_code == 201
    test_voucher_id = res_co.json()["data"]["id"]

    # Helper function to create a test role, user, and get login token
    async def create_user_with_permissions(role_name: str, perm_ids: list[str]):
        unique_suffix = uuid.uuid4().hex[:6]
        role_code = f"r_{unique_suffix}"
        username = f"u_{unique_suffix}"
        password = "User@Password2026!"

        # 1. Create Role
        res_role = await async_client.post(
            "/api/v1/roles",
            headers=auth_headers,
            json={"name": f"{role_name}_{unique_suffix}", "code": role_code, "description": f"Test role {role_name}"},
        )
        assert res_role.status_code == 201, res_role.text
        role_id = res_role.json()["data"]["id"]

        # 2. Assign Permissions via Matrix endpoint
        res_assign = await async_client.put(
            f"/api/v1/roles/{role_id}/permissions",
            headers=auth_headers,
            json={"permission_ids": perm_ids},
        )
        assert res_assign.status_code == 200, res_assign.text
        assert len(res_assign.json()["data"]["permissions"]) == len(perm_ids)

        # 3. Create User
        res_user = await async_client.post(
            "/api/v1/users",
            headers=auth_headers,
            json={
                "username": username,
                "password": password,
                "full_name": f"Test {role_name}",
                "email": f"{username}@test.com",
                "phone": f"017{unique_suffix[:8].ljust(8, '0')}",
                "role_id": role_id,
            },
        )
        assert res_user.status_code == 201, res_user.text

        # 4. Login as this user
        res_login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": password},
        )
        assert res_login.status_code == 200, res_login.text
        token = res_login.json()["data"]["access_token"]
        return {"Authorization": f"Bearer {token}"}, role_id

    # Scenario 1: View Only
    headers_view_only, _ = await create_user_with_permissions("ViewOnly", [perm_id_view])
    # - Can View
    res = await async_client.get("/api/v1/accounts/cash-out", headers=headers_view_only)
    assert res.status_code == 200
    res_single = await async_client.get(f"/api/v1/accounts/cash-out/{test_voucher_id}", headers=headers_view_only)
    assert res_single.status_code == 200
    # - Cannot Edit
    res_edit = await async_client.put(
        f"/api/v1/accounts/cash-out/{test_voucher_id}",
        headers=headers_view_only,
        json={"amount": 1200.0, "reason": "Edit Attempt ViewOnly"},
    )
    assert res_edit.status_code == 403
    # - Cannot Delete
    res_del = await async_client.delete(f"/api/v1/accounts/cash-out/{test_voucher_id}", headers=headers_view_only)
    assert res_del.status_code == 403

    # Scenario 2: View + Edit
    headers_view_edit, _ = await create_user_with_permissions("ViewEdit", [perm_id_view, perm_id_edit])
    # - Can View
    res = await async_client.get("/api/v1/accounts/cash-out", headers=headers_view_edit)
    assert res.status_code == 200
    # - Can Edit
    res_edit = await async_client.put(
        f"/api/v1/accounts/cash-out/{test_voucher_id}",
        headers=headers_view_edit,
        json={"amount": 1500.0, "reason": "Updated by ViewEdit"},
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["data"]["amount"] == 1500.0
    # - Cannot Delete
    res_del = await async_client.delete(f"/api/v1/accounts/cash-out/{test_voucher_id}", headers=headers_view_edit)
    assert res_del.status_code == 403

    # Scenario 3: View + Delete
    # Create another voucher to test delete
    res_co2 = await async_client.post(
        "/api/v1/accounts/cash-out",
        headers=auth_headers,
        json={"amount": 800.0, "cash_out_date": test_date, "reason": "Voucher for Delete Test"},
    )
    v2_id = res_co2.json()["data"]["id"]

    headers_view_del, _ = await create_user_with_permissions("ViewDelete", [perm_id_view, perm_id_delete])
    # - Can View
    res = await async_client.get("/api/v1/accounts/cash-out", headers=headers_view_del)
    assert res.status_code == 200
    # - Cannot Edit
    res_edit = await async_client.put(
        f"/api/v1/accounts/cash-out/{v2_id}",
        headers=headers_view_del,
        json={"amount": 900.0, "reason": "Edit Attempt ViewDelete"},
    )
    assert res_edit.status_code == 403
    # - Can Delete
    res_del = await async_client.delete(f"/api/v1/accounts/cash-out/{v2_id}", headers=headers_view_del)
    assert res_del.status_code == 200

    # Scenario 4: View + Edit + Delete
    # Create voucher 3
    res_co3 = await async_client.post(
        "/api/v1/accounts/cash-out",
        headers=auth_headers,
        json={"amount": 500.0, "cash_out_date": test_date, "reason": "Voucher 3"},
    )
    v3_id = res_co3.json()["data"]["id"]

    headers_all, _ = await create_user_with_permissions("ViewEditDel", [perm_id_view, perm_id_edit, perm_id_delete])
    # - Can View
    res = await async_client.get("/api/v1/accounts/cash-out", headers=headers_all)
    assert res.status_code == 200
    # - Can Edit
    res_edit = await async_client.put(
        f"/api/v1/accounts/cash-out/{v3_id}",
        headers=headers_all,
        json={"amount": 550.0, "reason": "Updated by AllPerms"},
    )
    assert res_edit.status_code == 200
    # - Can Delete
    res_del = await async_client.delete(f"/api/v1/accounts/cash-out/{v3_id}", headers=headers_all)
    assert res_del.status_code == 200

    # Scenario 5: No View (e.g. empty or Edit-only without View)
    headers_no_view, _ = await create_user_with_permissions("NoView", [perm_id_edit, perm_id_delete])
    # - Cannot View Manage/List
    res_list = await async_client.get("/api/v1/accounts/cash-out", headers=headers_no_view)
    assert res_list.status_code == 403
    res_single = await async_client.get(f"/api/v1/accounts/cash-out/{test_voucher_id}", headers=headers_no_view)
    assert res_single.status_code == 403

    # Clean up test voucher 1
    await async_client.delete(f"/api/v1/accounts/cash-out/{test_voucher_id}", headers=auth_headers)
