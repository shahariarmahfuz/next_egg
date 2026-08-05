from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base
from app.repositories.base import BaseRepository

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Generic Base Service layer connecting repositories and endpoints.
    Enforces business validation and transaction boundaries.
    """

    def __init__(self, repository: BaseRepository[ModelType, CreateSchemaType, UpdateSchemaType]):
        self.repository = repository

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        return await self.repository.get_by_id(db, id=id)

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        return list(await self.repository.get_multi(db, skip=skip, limit=limit))

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        return await self.repository.create(db, obj_in=obj_in)

    async def update(
        self, db: AsyncSession, *, id: Any, obj_in: UpdateSchemaType
    ) -> Optional[ModelType]:
        db_obj = await self.repository.get_by_id(db, id=id)
        if not db_obj:
            return None
        return await self.repository.update(db, db_obj=db_obj, obj_in=obj_in)

    async def delete(self, db: AsyncSession, *, id: Any) -> bool:
        db_obj = await self.repository.soft_delete(db, id=id)
        return db_obj is not None
