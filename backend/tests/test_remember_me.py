import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from app.core.security import decode_token

@pytest.mark.asyncio
async def test_remember_me_true_login(async_client: AsyncClient):
    """Test that remember_me=True extends both access and refresh tokens to 30 days."""
    login_payload = {
        "username": "owner",
        "password": "Owner@Argon2Secure2026!",
        "remember_me": True,
    }
    res = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"
    body = res.json()["data"]
    
    # 1. Payload access_token expires_in should be 30 days (2592000 seconds)
    expected_30_days_sec = 30 * 86400
    assert abs(body["expires_in"] - expected_30_days_sec) <= 10, f"Expected expires_in ~30 days, got {body['expires_in']}"
    
    # 2. Decode access_token JWT and verify exp - iat is 30 days
    access_token = body["access_token"]
    access_payload = decode_token(access_token)
    access_duration = access_payload["exp"] - access_payload["iat"]
    assert abs(access_duration - expected_30_days_sec) <= 10, f"Access token JWT duration is not 30 days: {access_duration}"
    
    # 3. Check refresh_token cookie
    cookies = res.cookies
    assert "refresh_token" in cookies, "refresh_token cookie missing"
    refresh_token = cookies["refresh_token"]
    
    # 4. Decode refresh_token JWT and verify exp - iat is 30 days
    refresh_payload = decode_token(refresh_token)
    assert refresh_payload["type"] == "refresh"
    refresh_duration = refresh_payload["exp"] - refresh_payload["iat"]
    assert abs(refresh_duration - expected_30_days_sec) <= 10, f"Refresh token JWT duration is not 30 days: {refresh_duration}"


@pytest.mark.asyncio
async def test_remember_me_false_login(async_client: AsyncClient):
    """Test that remember_me=False preserves standard short token validity."""
    login_payload = {
        "username": "owner",
        "password": "Owner@Argon2Secure2026!",
        "remember_me": False,
    }
    res = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"
    body = res.json()["data"]
    
    # Standard access token is 24h (86400s)
    expected_access_sec = 86400
    assert abs(body["expires_in"] - expected_access_sec) <= 10
    
    access_payload = decode_token(body["access_token"])
    access_duration = access_payload["exp"] - access_payload["iat"]
    assert abs(access_duration - expected_access_sec) <= 10
    
    # Standard refresh token is 7 days (604800s)
    expected_refresh_sec = 7 * 86400
    refresh_token = res.cookies["refresh_token"]
    refresh_payload = decode_token(refresh_token)
    refresh_duration = refresh_payload["exp"] - refresh_payload["iat"]
    assert abs(refresh_duration - expected_refresh_sec) <= 10


@pytest.mark.asyncio
async def test_refresh_token_via_cookie(async_client: AsyncClient):
    """Test that /auth/refresh can extract refresh_token from HTTP-Only cookie without request body."""
    # 1. Login to get cookie
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "Owner@Argon2Secure2026!", "remember_me": True},
    )
    assert login_res.status_code == 200
    refresh_cookie = login_res.cookies["refresh_token"]

    # 2. Call /auth/refresh with empty payload and cookie
    refresh_res = await async_client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": refresh_cookie},
    )
    assert refresh_res.status_code == 200, f"Refresh failed: {refresh_res.text}"
    data = refresh_res.json()["data"]
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_token_missing_rejected(async_client: AsyncClient):
    """Test that /auth/refresh without body or cookie returns 401."""
    res = await async_client.post("/api/v1/auth/refresh")
    assert res.status_code == 401
