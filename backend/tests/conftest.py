import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.main import create_app
from app.db.session import engine

app = create_app()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_db_connections():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def auth_headers(async_client):
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "owner", "password": "Owner@Argon2Secure2026!"},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
