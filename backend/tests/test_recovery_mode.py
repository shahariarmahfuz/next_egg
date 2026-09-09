import pytest
from datetime import datetime, timedelta, timezone
from httpx import ASGITransport, AsyncClient
from app.main import create_app
from app.db.session import AsyncSessionLocal, engine
from app.repositories.user_repository import user_repository
from app.core.security import get_password_hash

app = create_app()

@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
async def seed_users():
    """Ensure test users exist in the database."""
    async with AsyncSessionLocal() as db:
        # Check owner
        owner = await user_repository.get_by_username(db, "owner")
        admin = await user_repository.get_by_username(db, "admin")
        employee = await user_repository.get_by_username(db, "employee")
        from app.repositories.role_repository import role_repository

        if not admin:
            admin_role = await role_repository.get_by_code(db, "admin")
            admin = await user_repository.create(
                db,
                obj_in={
                    "full_name": "System Administrator",
                    "username": "admin",
                    "email": "admin@enterprise.com",
                    "password_hash": get_password_hash("AdminTest123!"),
                    "role_id": admin_role.id if admin_role else owner.role_id,
                    "status": "active",
                },
            )
        else:
            admin.password_hash = get_password_hash("AdminTest123!")
            admin.recovery_mode_enabled = False
            admin.recovery_token_hash = None
            admin.recovery_token_expires_at = None
            db.add(admin)

        if not employee:
            emp_role = await role_repository.get_by_code(db, "employee")
            employee = await user_repository.create(
                db,
                obj_in={
                    "full_name": "System Employee",
                    "username": "employee",
                    "email": "employee@enterprise.com",
                    "password_hash": get_password_hash("EmployeeTest123!"),
                    "role_id": emp_role.id if emp_role else (admin.role_id if admin else owner.role_id),
                    "status": "active",
                },
            )
        else:
            employee.password_hash = get_password_hash("EmployeeTest123!")
            employee.recovery_mode_enabled = False
            employee.recovery_token_hash = None
            employee.recovery_token_expires_at = None
            db.add(employee)

        # Create or update User A and User B for recovery testing
        role_emp = employee.role if employee else None
        role_id = role_emp.id if role_emp else (admin.role_id if admin else owner.role_id)

        user_a = await user_repository.get_by_username(db, "test_user_a")
        if not user_a:
            user_a = await user_repository.create(
                db,
                obj_in={
                    "full_name": "Test User A",
                    "username": "test_user_a",
                    "email": "user_a@test.com",
                    "password_hash": get_password_hash("OldPassword123!"),
                    "role_id": role_id,
                    "status": "active",
                },
            )
        else:
            user_a.password_hash = get_password_hash("OldPassword123!")
            user_a.recovery_mode_enabled = False
            user_a.recovery_token_hash = None
            user_a.recovery_token_expires_at = None
            db.add(user_a)

        user_b = await user_repository.get_by_username(db, "test_user_b")
        if not user_b:
            user_b = await user_repository.create(
                db,
                obj_in={
                    "full_name": "Test User B",
                    "username": "test_user_b",
                    "email": "user_b@test.com",
                    "password_hash": get_password_hash("PasswordB123!"),
                    "role_id": role_id,
                    "status": "active",
                },
            )
        else:
            user_b.password_hash = get_password_hash("PasswordB123!")
            user_b.recovery_mode_enabled = False
            user_b.recovery_token_hash = None
            user_b.recovery_token_expires_at = None
            db.add(user_b)

        await db.commit()
        await db.refresh(user_a)
        await db.refresh(user_b)

    return {"user_a_id": user_a.id, "user_b_id": user_b.id}


# Helper fixture to get auth headers
@pytest.fixture
async def auth_tokens(async_client, seed_users):
    owner_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "Owner@Argon2Secure2026!"},
    )
    admin_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminTest123!"},
    )
    emp_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "employee", "password": "EmployeeTest123!"},
    )
    return {
        "owner_headers": {"Authorization": f"Bearer {owner_res.json()['data']['access_token']}"},
        "admin_headers": {"Authorization": f"Bearer {admin_res.json()['data']['access_token']}"},
        "emp_headers": {"Authorization": f"Bearer {emp_res.json()['data']['access_token']}"},
    }


@pytest.mark.anyio
async def test_case_c_admin_cannot_enable_recovery(async_client, seed_users, auth_tokens):
    """Test Case C: Admin tries to enable Recovery Mode -> Backend rejects it (403 Forbidden)."""
    user_a_id = seed_users["user_a_id"]
    res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["admin_headers"],
    )
    assert res.status_code == 403
    assert "Only the System Owner can enable Recovery Mode" in res.json()["error"]["message"]


@pytest.mark.anyio
async def test_case_d_employee_cannot_enable_recovery(async_client, seed_users, auth_tokens):
    """Test Case D: Employee tries to enable Recovery Mode -> Backend rejects it (403 Forbidden)."""
    user_a_id = seed_users["user_a_id"]
    res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["emp_headers"],
    )
    assert res.status_code == 403
    assert "Only the System Owner can enable Recovery Mode" in res.json()["error"]["message"]


@pytest.mark.anyio
async def test_case_b_user_recovery_off_cannot_recover(async_client, seed_users):
    """Test Case B: User B has Recovery Mode OFF -> User B cannot use recovery flow."""
    res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_b", "recovery_code": "REC-AAAA-BBBB"},
    )
    assert res.status_code == 400
    assert "Recovery mode is not active" in res.json()["error"]["message"]


@pytest.mark.anyio
async def test_case_i_normal_login_unchanged(async_client, seed_users):
    """Test Case I: Normal login for users without Recovery Mode -> Completely unchanged."""
    wrong_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_b", "password": "WrongPassword!"},
    )
    assert wrong_res.status_code == 401
    assert "Invalid credentials" in wrong_res.json()["error"]["message"]

    correct_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_b", "password": "PasswordB123!"},
    )
    assert correct_res.status_code == 200
    assert correct_res.json()["data"]["recovery_required"] is False
    assert correct_res.json()["data"]["access_token"] is not None


@pytest.mark.anyio
async def test_case_a_owner_enables_recovery_mode(async_client, seed_users, auth_tokens):
    """Test Case A: Owner enables Recovery Mode for User A -> User A enters recovery flow via login page."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    assert enable_res.status_code == 200
    data = enable_res.json()["data"]
    assert data["recovery_mode_enabled"] is True
    assert data["recovery_code"].startswith("REC-")

    # User attempts login with forgotten password
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_a", "password": "forgotten_password"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()["data"]
    assert login_data["recovery_required"] is True
    assert login_data["recovery_verified"] is False
    assert login_data["username"] == "test_user_a"
    assert login_data.get("access_token") is None


@pytest.mark.anyio
async def test_case_e_recovery_completion_lifecycle(async_client, seed_users, auth_tokens):
    """Test Case E: Recovery completed successfully: new pw works, old pw fails, recovery mode auto OFF."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    recovery_code = enable_res.json()["data"]["recovery_code"]

    # Verify recovery code
    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert verify_res.status_code == 200
    recovery_token = verify_res.json()["data"]["recovery_token"]

    # Save new password
    reset_res = await async_client.post(
        "/api/v1/auth/recovery/reset-password",
        json={"recovery_token": recovery_token, "new_password": "BrandNewPassword2026!"},
    )
    assert reset_res.status_code == 200

    # Old password no longer works
    old_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_a", "password": "OldPassword123!"},
    )
    assert old_res.status_code == 401

    # New password works normally
    new_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_a", "password": "BrandNewPassword2026!"},
    )
    assert new_res.status_code == 200
    assert new_res.json()["data"]["recovery_required"] is False
    assert new_res.json()["data"]["access_token"] is not None

    # Recovery Mode automatically became OFF
    async with AsyncSessionLocal() as db:
        user = await user_repository.get_by_id(db, user_a_id)
        assert user.recovery_mode_enabled is False
        assert user.recovery_token_hash is None


@pytest.mark.anyio
async def test_case_f_recovery_token_reuse_rejected(async_client, seed_users, auth_tokens):
    """Test Case F: Recovery token reused -> Reject it."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    recovery_code = enable_res.json()["data"]["recovery_code"]

    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    recovery_token = verify_res.json()["data"]["recovery_token"]

    # Complete reset once
    await async_client.post(
        "/api/v1/auth/recovery/reset-password",
        json={"recovery_token": recovery_token, "new_password": "NewPasswordCaseF1!"},
    )

    # Attempt to reuse recovery code -> Rejected
    reused_code = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert reused_code.status_code == 400

    # Attempt to reuse recovery token -> Rejected
    reused_token = await async_client.post(
        "/api/v1/auth/recovery/reset-password",
        json={"recovery_token": recovery_token, "new_password": "AnotherPasswordF2!"},
    )
    assert reused_token.status_code == 400


@pytest.mark.anyio
async def test_case_g_recovery_token_expired_rejected(async_client, seed_users, auth_tokens):
    """Test Case G: Recovery token expired -> Reject it."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    recovery_code = enable_res.json()["data"]["recovery_code"]

    # Manually expire in DB
    async with AsyncSessionLocal() as db:
        user = await user_repository.get_by_id(db, user_a_id)
        user.recovery_token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        db.add(user)
        await db.commit()

    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert verify_res.status_code == 400
    assert "expired" in verify_res.json()["error"]["message"].lower()


@pytest.mark.anyio
async def test_case_h_owner_manually_disables_recovery(async_client, seed_users, auth_tokens):
    """Test Case H: Owner manually disables Recovery Mode -> Recovery flow becomes unavailable."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    recovery_code = enable_res.json()["data"]["recovery_code"]

    # Disable manually
    disable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/disable",
        headers=auth_tokens["owner_headers"],
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["data"]["recovery_mode_enabled"] is False

    # Attempt to verify recovery code -> Fails
    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert verify_res.status_code == 400
    assert "Recovery mode is not active" in verify_res.json()["error"]["message"]


@pytest.mark.anyio
async def test_security_recovery_session_not_normal_session(async_client, seed_users, auth_tokens):
    """Security verification: Recovery session token cannot access normal authenticated application APIs."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    recovery_code = enable_res.json()["data"]["recovery_code"]

    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    recovery_token = verify_res.json()["data"]["recovery_token"]

    # Try calling /auth/me with recovery token -> REJECTED 401
    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {recovery_token}"},
    )
    assert me_res.status_code == 401
    assert "Invalid token type" in me_res.json()["error"]["message"]

    # Try calling /users with recovery token -> REJECTED 401
    users_res = await async_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {recovery_token}"},
    )
    assert users_res.status_code == 401
    assert "Invalid token type" in users_res.json()["error"]["message"]


@pytest.mark.anyio
@pytest.mark.parametrize("short_password", ["1", "a", "123", "abc", "12345"])
async def test_recovery_password_any_non_empty_accepted(async_client, seed_users, auth_tokens, short_password):
    """Test: User can set any non-empty password ('1', 'a', '123', etc.) in Recovery Mode."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    assert enable_res.status_code == 200
    recovery_code = enable_res.json()["data"]["recovery_code"]

    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert verify_res.status_code == 200
    recovery_token = verify_res.json()["data"]["recovery_token"]

    # Reset password with short password
    reset_res = await async_client.post(
        "/api/v1/auth/recovery/reset-password",
        json={"recovery_token": recovery_token, "new_password": short_password},
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # Login with the new short password succeeds
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_a", "password": short_password},
    )
    assert login_res.status_code == 200
    assert login_res.json()["data"]["recovery_required"] is False
    assert login_res.json()["data"]["access_token"] is not None


@pytest.mark.anyio
async def test_recovery_password_empty_rejected(async_client, seed_users, auth_tokens):
    """Test: Empty password MUST NOT be accepted in Recovery Mode."""
    user_a_id = seed_users["user_a_id"]
    enable_res = await async_client.post(
        f"/api/v1/users/{user_a_id}/recovery-mode/enable",
        headers=auth_tokens["owner_headers"],
    )
    assert enable_res.status_code == 200
    recovery_code = enable_res.json()["data"]["recovery_code"]

    verify_res = await async_client.post(
        "/api/v1/auth/recovery/verify",
        json={"username": "test_user_a", "recovery_code": recovery_code},
    )
    assert verify_res.status_code == 200
    recovery_token = verify_res.json()["data"]["recovery_token"]

    # Reset with empty password -> REJECTED (422 / 400)
    reset_res = await async_client.post(
        "/api/v1/auth/recovery/reset-password",
        json={"recovery_token": recovery_token, "new_password": ""},
    )
    assert reset_res.status_code in (400, 422)


@pytest.mark.anyio
async def test_normal_password_change_policy_unchanged(async_client, seed_users, auth_tokens):
    """Test: Normal user password update flow functions as before without interference."""
    user_b_id = seed_users["user_b_id"]
    # Owner updates user_b password via standard User Management
    update_res = await async_client.put(
        f"/api/v1/users/{user_b_id}",
        json={"password": "NewUpdatedPassword123!"},
        headers=auth_tokens["owner_headers"],
    )
    assert update_res.status_code == 200

    # User B logs in with new updated password
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "test_user_b", "password": "NewUpdatedPassword123!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["data"]["access_token"] is not None


