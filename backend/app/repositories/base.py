import math
from typing import Any, Generic, List, Optional, Sequence, Type, TypeVar, Union
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Generic Async Repository implementing standard CRUD and soft-delete operations.
    Follows Clean Architecture & Repository Pattern principles.
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get_by_id(
        self, db: AsyncSession, id: Any, include_deleted: bool = False
    ) -> Optional[ModelType]:
        """Fetch a single record by primary key."""
        query = select(self.model).where(self.model.id == id)
        if hasattr(self.model, "is_deleted") and not include_deleted:
            query = query.where(self.model.is_deleted == False)  # noqa: E712
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
    ) -> Sequence[ModelType]:
        """Fetch multiple records with pagination support."""
        query = select(self.model)
        if hasattr(self.model, "is_deleted") and not include_deleted:
            query = query.where(self.model.is_deleted == False)  # noqa: E712
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def count(self, db: AsyncSession, include_deleted: bool = False) -> int:
        """Count total records."""
        query = select(func.count()).select_from(self.model)
        if hasattr(self.model, "is_deleted") and not include_deleted:
            query = query.where(self.model.is_deleted == False)  # noqa: E712
        result = await db.execute(query)
        return result.scalar() or 0

    async def create(self, db: AsyncSession, *, obj_in: Union[CreateSchemaType, dict[str, Any]]) -> ModelType:
        """Create a new record."""
        obj_in_data = obj_in.model_dump() if isinstance(obj_in, BaseModel) else obj_in
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, dict[str, Any]],
    ) -> ModelType:
        """Update an existing record."""
        update_data = (
            obj_in.model_dump(exclude_unset=True)
            if isinstance(obj_in, BaseModel)
            else obj_in
        )
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def soft_delete(self, db: AsyncSession, *, id: Any) -> Optional[ModelType]:
        """Soft delete a record by setting is_deleted=True."""
        db_obj = await self.get_by_id(db, id=id)
        if db_obj and hasattr(db_obj, "is_deleted"):
            setattr(db_obj, "is_deleted", True)
            db.add(db_obj)
            await db.flush()
            await db.refresh(db_obj)
        return db_obj

    async def hard_delete(self, db: AsyncSession, *, id: Any) -> bool:
        """Permanently delete a record."""
        db_obj = await self.get_by_id(db, id=id, include_deleted=True)
        if db_obj:
            await db.delete(db_obj)
            await db.flush()
            return True
        return False
