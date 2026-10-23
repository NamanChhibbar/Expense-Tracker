'''Request body models and their validation rules.'''

import re
from datetime import date

from pydantic import BaseModel, Field, field_validator

from .config import (
  CATEGORIES,
  CURRENCIES,
  DEFAULT_CATEGORY,
  DEFAULT_CURRENCY,
  DEFAULT_EMOJI,
)


class User(BaseModel):
  name: str = Field(min_length=1, max_length=40)
  emoji: str = DEFAULT_EMOJI
  currency: str = DEFAULT_CURRENCY

  @field_validator('name')
  @classmethod
  def strip_name(cls, v: str) -> str:
    v = v.strip()
    if not v:
      raise ValueError('is required')
    return v

  @field_validator('emoji')
  @classmethod
  def clean_emoji(cls, v: str) -> str:
    return v.strip()[:8] or DEFAULT_EMOJI

  @field_validator('currency')
  @classmethod
  def known_currency(cls, v: str) -> str:
    return v if v in CURRENCIES else DEFAULT_CURRENCY


class Expense(BaseModel):
  description: str = Field(min_length=1, max_length=80)
  amount: float = Field(gt=0, le=1e9)
  category: str = DEFAULT_CATEGORY
  date: str | None = None

  @field_validator('description')
  @classmethod
  def strip_description(cls, v: str) -> str:
    v = v.strip()
    if not v:
      raise ValueError('is required')
    return v

  @field_validator('category')
  @classmethod
  def known_category(cls, v: str) -> str:
    return v if v in CATEGORIES else DEFAULT_CATEGORY

  @field_validator('date')
  @classmethod
  def valid_date(cls, v: str | None) -> str:
    if v and re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
      date.fromisoformat(v)  # rejects impossible dates like 2026-02-31
      return v
    return date.today().isoformat()
