import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_calculator_rbac_permission(async_client: AsyncClient, auth_headers: dict):
    # 1. Verify calculator.view permission is registered
    res = await async_client.get("/api/v1/permissions", headers=auth_headers)
    assert res.status_code == 200
    perms = res.json()["data"]

    calc_perm = next((p for p in perms if p["code"] == "calculator.view"), None)
    assert calc_perm is not None, "calculator.view permission not found in database permissions"
    assert calc_perm["module"] == "calculator"
    assert "Calculators" in calc_perm["name"]

    # 2. Verify roles have calculator.view permission assigned
    res_roles = await async_client.get("/api/v1/roles", headers=auth_headers)
    assert res_roles.status_code == 200
    roles = res_roles.json()["data"]

    admin_role = next((r for r in roles if r["code"] == "admin"), None)
    assert admin_role is not None
    admin_perm_codes = {p["code"] for p in admin_role.get("permissions", [])}
    assert "calculator.view" in admin_perm_codes, "calculator.view is not assigned to Admin role"

    employee_role = next((r for r in roles if r["code"] == "employee"), None)
    assert employee_role is not None
    employee_perm_codes = {p["code"] for p in employee_role.get("permissions", [])}
    assert "calculator.view" in employee_perm_codes, "calculator.view is not assigned to Employee role"
