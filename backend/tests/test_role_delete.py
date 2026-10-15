import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_role_deletion_and_protection(async_client: AsyncClient, auth_headers: dict):
    # 1. Fetch existing roles
    res_roles = await async_client.get("/api/v1/roles", headers=auth_headers)
    assert res_roles.status_code == 200
    roles = res_roles.json()["data"]

    owner_role = next((r for r in roles if r["code"] == "owner"), None)
    admin_role = next((r for r in roles if r["code"] == "admin"), None)
    employee_role = next((r for r in roles if r["code"] == "employee"), None)

    # 2. Verify deletion of system roles is strictly blocked
    if owner_role:
        res_del_owner = await async_client.delete(f"/api/v1/roles/{owner_role['id']}", headers=auth_headers)
        assert res_del_owner.status_code == 400
        assert "System roles cannot be deleted" in res_del_owner.text

    if admin_role:
        res_del_admin = await async_client.delete(f"/api/v1/roles/{admin_role['id']}", headers=auth_headers)
        assert res_del_admin.status_code == 400
        assert "System roles cannot be deleted" in res_del_admin.text

    if employee_role:
        res_del_emp = await async_client.delete(f"/api/v1/roles/{employee_role['id']}", headers=auth_headers)
        assert res_del_emp.status_code == 400
        assert "System roles cannot be deleted" in res_del_emp.text

    # 3. Create a custom role with 0 users and delete it
    suffix = uuid.uuid4().hex[:6]
    res_create = await async_client.post(
        "/api/v1/roles",
        headers=auth_headers,
        json={
            "name": f"Custom Unassigned Role {suffix}",
            "code": f"custom_unassigned_{suffix}",
            "description": "Test unassigned custom role",
        },
    )
    assert res_create.status_code == 201
    custom_role_id = res_create.json()["data"]["id"]

    res_del_custom = await async_client.delete(f"/api/v1/roles/{custom_role_id}", headers=auth_headers)
    assert res_del_custom.status_code == 200
    assert res_del_custom.json()["data"]["id"] == custom_role_id

    # Verify role no longer exists
    res_get_deleted = await async_client.get(f"/api/v1/roles/{custom_role_id}", headers=auth_headers)
    assert res_get_deleted.status_code == 404

    # 4. Create a custom role with 1 user assigned, then delete the role
    suffix_assigned = uuid.uuid4().hex[:6]
    res_create_assigned = await async_client.post(
        "/api/v1/roles",
        headers=auth_headers,
        json={
            "name": f"Custom Assigned Role {suffix_assigned}",
            "code": f"custom_assigned_{suffix_assigned}",
            "description": "Test assigned custom role",
        },
    )
    assert res_create_assigned.status_code == 201
    assigned_role_id = res_create_assigned.json()["data"]["id"]

    # Create a user with this role
    username = f"user_{suffix_assigned}"
    res_user = await async_client.post(
        "/api/v1/users",
        headers=auth_headers,
        json={
            "username": username,
            "full_name": f"Test User {suffix_assigned}",
            "password": "Password123!",
            "role_id": assigned_role_id,
        },
    )
    assert res_user.status_code in [200, 201]
    created_user_id = res_user.json()["data"]["id"]

    # Delete the custom role that has 1 user assigned
    res_del_assigned_role = await async_client.delete(f"/api/v1/roles/{assigned_role_id}", headers=auth_headers)
    assert res_del_assigned_role.status_code == 200

    # Verify the user is reassigned to the default employee role
    res_check_user = await async_client.get(f"/api/v1/users/{created_user_id}", headers=auth_headers)
    assert res_check_user.status_code == 200
    user_data = res_check_user.json()["data"]
    assert user_data["role"]["code"] == "employee"
