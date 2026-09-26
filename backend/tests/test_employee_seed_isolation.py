import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.db.seed import seed_initial_data
from app.repositories.user_repository import user_repository
from app.repositories.role_repository import role_repository
from app.services.user_service import user_service
from app.services.auth_service import auth_service
from app.schemas.user import UserCreate
from app.schemas.auth import LoginRequest
from app.exceptions import ForbiddenException, NotFoundException


@pytest_asyncio.fixture
async def isolated_db():
    """Completely isolated in-memory SQLite database - zero production touch."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with session_maker() as session:
        yield session

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_no_system_employee_on_initial_seed_and_restart(isolated_db: AsyncSession):
    """
    Verify:
    1. First startup / seed registers owner and admin, but NOT 'System Employee'.
    2. Simulated server restarts (re-running seed_initial_data) do NOT create 'System Employee'.
    """
    db = isolated_db

    # Step 1: Initial startup / database initialization
    await seed_initial_data(db)

    # Verify Owner and Admin exist
    owner = await user_repository.get_by_username(db, "owner")
    assert owner is not None
    assert owner.full_name == "System Owner"
    assert owner.role.code == "owner"

    admin = await user_repository.get_by_username(db, "admin")
    assert admin is not None
    assert admin.full_name == "System Administrator"
    assert admin.role.code == "admin"

    # Confirm NO 'employee' user exists
    employee_by_username = await user_repository.get_by_username(db, "employee")
    assert employee_by_username is None

    result = await db.execute(select(User).where(User.full_name == "System Employee"))
    system_employee = result.scalars().first()
    assert system_employee is None

    # Step 2: Simulate repeated server restarts
    for _ in range(3):
        await seed_initial_data(db)
        emp = await user_repository.get_by_username(db, "employee")
        assert emp is None, "Server restart must NOT recreate 'employee' user!"


@pytest.mark.asyncio
async def test_manual_employee_creation_and_deletion_restart_lifecycle(isolated_db: AsyncSession):
    """
    Verify:
    1. Owner can manually create an Employee through the Add User flow.
    2. The Employee can be deleted.
    3. Server restart after deletion does NOT re-create 'System Employee' or 'employee'.
    """
    db = isolated_db
    await seed_initial_data(db)

    owner = await user_repository.get_by_username(db, "owner")
    assert owner is not None

    emp_role = await role_repository.get_by_code(db, "employee")
    assert emp_role is not None

    # Owner manually creates an Employee
    user_in = UserCreate(
        full_name="John Staff",
        username="john_staff",
        email="john.staff@example.com",
        phone="+18005550999",
        password="StaffSecurePassword123!",
        role_id=emp_role.id,
        status="active",
    )
    new_user = await user_service.create_user(db, user_in, current_user=owner)
    assert new_user is not None
    assert new_user.username == "john_staff"
    assert new_user.role.code == "employee"

    # Verify the created employee can log in
    login_result, _ = await auth_service.login(
        db,
        LoginRequest(username="john_staff", password="StaffSecurePassword123!")
    )
    assert login_result.access_token is not None

    # Delete the employee
    deleted = await user_service.delete_user(db, new_user.id, current_user=owner)
    assert deleted is True

    user_check = await user_repository.get_by_id(db, new_user.id)
    assert user_check is None

    # Simulate server restart after user deletion
    await seed_initial_data(db)

    # Verify neither 'employee' nor 'john_staff' was automatically re-created
    assert await user_repository.get_by_username(db, "employee") is None
    assert await user_repository.get_by_username(db, "john_staff") is None


@pytest.mark.asyncio
async def test_admin_can_create_employee_according_to_rbac(isolated_db: AsyncSession):
    """
    Verify:
    1. Admin can create an Employee user.
    2. Admin CANNOT create an Owner user (404/Forbidden).
    3. Admin CANNOT create another Admin user (403 Forbidden).
    """
    db = isolated_db
    await seed_initial_data(db)

    admin = await user_repository.get_by_username(db, "admin")
    assert admin is not None

    emp_role = await role_repository.get_by_code(db, "employee")
    owner_role = await role_repository.get_by_code(db, "owner")
    admin_role = await role_repository.get_by_code(db, "admin")

    # 1. Admin creates Employee -> Success
    emp_in = UserCreate(
        full_name="Alice Worker",
        username="alice_worker",
        email="alice@example.com",
        phone="+18005550888",
        password="AliceSecure123!",
        role_id=emp_role.id,
        status="active",
    )
    created_emp = await user_service.create_user(db, emp_in, current_user=admin)
    assert created_emp is not None
    assert created_emp.role.code == "employee"

    # 2. Admin tries to create Owner -> Blocked
    owner_in = UserCreate(
        full_name="Fake Owner",
        username="fake_owner",
        email="fake_owner@example.com",
        password="FakePassword123!",
        role_id=owner_role.id,
        status="active",
    )
    with pytest.raises(NotFoundException):
        await user_service.create_user(db, owner_in, current_user=admin)

    # 3. Admin tries to create Admin -> Blocked (Forbidden)
    second_admin_in = UserCreate(
        full_name="Second Admin",
        username="second_admin",
        email="second_admin@example.com",
        password="SecondAdmin123!",
        role_id=admin_role.id,
        status="active",
    )
    with pytest.raises(ForbiddenException):
        await user_service.create_user(db, second_admin_in, current_user=admin)


@pytest.mark.asyncio
async def test_existing_users_still_log_in(isolated_db: AsyncSession):
    """
    Verify:
    Owner and Admin seeded accounts can log in with their credentials.
    """
    db = isolated_db
    await seed_initial_data(db)

    # Owner login
    owner_res, _ = await auth_service.login(
        db,
        LoginRequest(username="owner", password="Owner@Argon2Secure2026!")
    )
    assert owner_res.access_token is not None
    assert owner_res.user.role.code == "owner"

    # Admin login
    admin_res, _ = await auth_service.login(
        db,
        LoginRequest(username="admin", password="Admin@Argon2Secure2026!")
    )
    assert admin_res.access_token is not None
    assert admin_res.user.role.code == "admin"
