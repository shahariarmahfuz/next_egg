# Development Guide

## Architectural Guidelines

When adding new features to this foundation, adhere strictly to the following conventions:

### Adding New API Endpoints (Backend)

1. **Database Model**: Define SQLAlchemy model in `backend/app/models/` inheriting from `TimestampedBaseModel`.
2. **Pydantic Schemas**: Define Request/Response schemas in `backend/app/schemas/`.
3. **Repository**: Extend `BaseRepository[Model, CreateSchema, UpdateSchema]` in `backend/app/repositories/`.
4. **Service Layer**: Extend `BaseService` in `backend/app/services/` for business logic and validation.
5. **Endpoint Controller**: Add router handler in `backend/app/api/v1/endpoints/` and register in `router.py`.

### Adding New UI Components/Pages (Frontend)

1. **RSC First**: Build pages in `frontend/src/app/` as React Server Components.
2. **Interactive UI**: Use `"use client"` only for components requiring hooks (`useState`, `useEffect`, event listeners).
3. **API Client**: Define typed API calls using `http` wrapper in `frontend/src/services/`.
4. **TanStack Query**: Wrap client-side data fetching with `useQuery` or `useMutation`.

## Code Quality & Verification Commands

### Frontend Verification

```bash
cd frontend

# Linting
npm run lint

# TypeScript Type Check
npx tsc --noEmit

# Production Build Verification
npm run build
```

### Backend Verification

```bash
cd backend

# Python Syntax Check
python3 -m py_compile app/main.py

# Run Alembic Migrations
alembic revision --autogenerate -m "Add new schema"
alembic upgrade head
```
