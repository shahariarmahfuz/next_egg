from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CashOutBase(BaseModel):
    amount: float = Field(..., gt=0, description="Amount taken out in cash (must be > 0)")
    cash_out_date: datetime = Field(..., description="Date and time when cash was withdrawn")
    reason: str = Field(..., min_length=1, max_length=255, description="Reason for cash out (e.g. Owner Withdrawal)")
    notes: Optional[str] = Field(None, description="Additional notes")
    note: Optional[str] = Field(None, description="Alias for notes")

    @model_validator(mode="after")
    def sync_note_fields(self):
        val = self.notes if self.notes is not None else self.note
        if val is not None:
            self.notes = val
            self.note = val
        return self


class CashOutCreate(CashOutBase):
    pass


class CashOutResponse(CashOutBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cash_out_no: str
    created_by_id: str
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
