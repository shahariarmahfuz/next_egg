from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.schemas.currency import CurrencyResponse, CurrencyCreate, CurrencyUpdate
from app.services.currency_service import currency_service
from app.models.user import User

router = APIRouter(prefix="/currencies", tags=["Currencies"])

@router.get("/", response_model=List[CurrencyResponse])
async def get_currencies(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    current_user: User = Depends(get_current_user)
):
    return await currency_service.get_all(db, skip=skip, limit=limit)

@router.get("/{id}", response_model=CurrencyResponse)
async def get_currency(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await currency_service.get_by_id(db, id=id)

@router.post("/", response_model=CurrencyResponse, status_code=status.HTTP_201_CREATED)
async def create_currency(
    currency_in: CurrencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await currency_service.create(db, obj_in=currency_in)

@router.put("/{id}", response_model=CurrencyResponse)
async def update_currency(
    id: str,
    currency_in: CurrencyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await currency_service.update(db, id=id, obj_in=currency_in)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_currency(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await currency_service.delete(db, id=id)
