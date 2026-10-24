'''Request body models and their validation rules.'''

import re
from datetime import date

from pydantic import BaseModel, Field, field_validator

from .config import (
  CATEGORIES,
  CURRENCIES,
  DEFAULT_CATEGORY,
  DEFAULT_CURRENCY,
)


class User(BaseModel):
  name: str = Field(min_length=1, max_length=40)
  currency: str = DEFAULT_CURRENCY

  @field_validator('name')
  @classmethod
  def strip_name(cls, v: str) -> str:
    v = v.strip()
    if not v:
      raise ValueError('is required')
    return v

  @field_validator('currency')
  @classmethod
  def known_currency(cls, v: str) -> str:
    return v if v in CURRENCIES else DEFAULT_CURRENCY


class Expense(BaseModel):
  description: str = Field(min_length=1, max_length=80)
  amount: float = Field(gt=0, le=1e9)
  category: str = DEFAULT_CATEGORY
  date: str | None = Field(default=None, validate_default=True)

  @field_validator('description')
  @classmethod
  def strip_description(cls, v: str) -> str:
    v = v.strip()
    if not v:
      raise ValueError('is required')
    return v

  @field_validator('amount')
  @classmethod
  def at_least_one_cent(cls, v: float) -> float:
    # Amounts are stored in cents, so anything that rounds to 0 would be rejected by the database.
    if round(v * 100) < 1:
      raise ValueError('must be at least 0.01')
    return v

  @field_validator('category')
  @classmethod
  def known_category(cls, v: str) -> str:
    return v if v in CATEGORIES else DEFAULT_CATEGORY

  @field_validator('date')
  @classmethod
  def valid_date(cls, v: str | None) -> str:
    if not v:
      return date.today().isoformat()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
      raise ValueError('must use the YYYY-MM-DD format')
    date.fromisoformat(v)  # rejects impossible dates like 2026-02-31
    return v
