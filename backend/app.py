'''FastAPI app: API routes, error handlers and the static frontend.'''

import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import EXPENSE_COLS, USER_COLS, connect, init_db
from .models import Expense, User
from .config import APP_TITLE, CATEGORIES, CURRENCIES, DEFAULT_CURRENCY, PUBLIC_DIR


@asynccontextmanager
async def lifespan(_: FastAPI):
  init_db()
  yield


app = FastAPI(title=APP_TITLE, lifespan=lifespan)


# Without this header, browsers may reuse a cached app.js or style.css after you edit them.
# 'no-cache' still allows caching, but makes the browser check for a newer version first.
@app.middleware('http')
async def revalidate_static_files(request: Request, call_next):
  response = await call_next(request)
  if not request.url.path.startswith('/api/'):
    response.headers.setdefault('Cache-Control', 'no-cache')
  return response


# The frontend expects errors shaped as {'error': 'message'}.
# Registered for Starlette's HTTPException so router errors like 404 and 405 are covered too.
@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
  return JSONResponse({'error': exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
  first = exc.errors()[0]
  field = str(first['loc'][-1]).capitalize()
  message = first['msg'].removeprefix('Value error, ')
  sep = ' ' if message.startswith(('is ', 'must ')) else ': '
  return JSONResponse({'error': f'{field}{sep}{message}'}, status_code=400)


def require_user(conn: sqlite3.Connection, user_id: int) -> None:
  if not conn.execute('SELECT 1 FROM users WHERE id = ?', (user_id,)).fetchone():
    raise HTTPException(404, 'User not found')


@app.get('/api/users')
def list_users():
  with connect() as conn:
    users = conn.execute(f'SELECT {USER_COLS} FROM users ORDER BY name').fetchall()
  return {
    'users': [dict(u) for u in users],
    'categories': CATEGORIES,
    'currencies': CURRENCIES,
    'default_currency': DEFAULT_CURRENCY,
  }


@app.post('/api/users', status_code=201)
def create_user(body: User):
  try:
    with connect() as conn:
      cur = conn.execute(
        'INSERT INTO users (name, currency) VALUES (?, ?)',
        (body.name, body.currency),
      )
      row = conn.execute(f'SELECT {USER_COLS} FROM users WHERE id = ?', (cur.lastrowid,)).fetchone()
  except sqlite3.IntegrityError:
    raise HTTPException(409, 'That name is already taken')
  return dict(row)


@app.get('/api/users/{user_id}/expenses')
def list_expenses(user_id: int):
  with connect() as conn:
    require_user(conn, user_id)
    rows = conn.execute(
      f'SELECT {EXPENSE_COLS} FROM expenses WHERE user_id = ? ORDER BY spent_on DESC, id DESC',
      (user_id,),
    ).fetchall()
  return [dict(r) for r in rows]


@app.post('/api/users/{user_id}/expenses', status_code=201)
def create_expense(user_id: int, body: Expense):
  with connect() as conn:
    require_user(conn, user_id)
    cur = conn.execute(
      'INSERT INTO expenses (user_id, description, amount_cents, category, spent_on) VALUES (?, ?, ?, ?, ?)',
      (user_id, body.description, round(body.amount * 100), body.category, body.date),
    )
    row = conn.execute(f'SELECT {EXPENSE_COLS} FROM expenses WHERE id = ?', (cur.lastrowid,)).fetchone()
  return dict(row)


@app.put('/api/expenses/{expense_id}')
def update_expense(expense_id: int, body: Expense):
  with connect() as conn:
    cur = conn.execute(
      'UPDATE expenses SET description = ?, amount_cents = ?, category = ?, spent_on = ? WHERE id = ?',
      (body.description, round(body.amount * 100), body.category, body.date, expense_id),
    )
    if cur.rowcount == 0:
      raise HTTPException(404, 'Expense not found')
    row = conn.execute(f'SELECT {EXPENSE_COLS} FROM expenses WHERE id = ?', (expense_id,)).fetchone()
  return dict(row)


@app.get('/api/admin/users')
def admin_list_users():
  with connect() as conn:
    rows = conn.execute(
      '''
      SELECT u.id, u.name, u.currency, u.created_at,
        COUNT(e.id) AS expense_count,
        COALESCE(SUM(e.amount_cents), 0) AS total_cents,
        MAX(e.spent_on) AS last_spent_on
      FROM users u LEFT JOIN expenses e ON e.user_id = u.id
      GROUP BY u.id
      ORDER BY u.name
      '''
    ).fetchall()
  return [dict(r) for r in rows]


# The user's expenses are removed too, by the ON DELETE CASCADE in the schema.
@app.delete('/api/admin/users/{user_id}', status_code=204)
def admin_delete_user(user_id: int):
  with connect() as conn:
    cur = conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
  if cur.rowcount == 0:
    raise HTTPException(404, 'User not found')
  return Response(status_code=204)


@app.delete('/api/expenses/{expense_id}', status_code=204)
def delete_expense(expense_id: int):
  with connect() as conn:
    cur = conn.execute('DELETE FROM expenses WHERE id = ?', (expense_id,))
  if cur.rowcount == 0:
    raise HTTPException(404, 'Expense not found')
  return Response(status_code=204)


# StaticFiles only maps folders to index.html, so /admin needs its own route.
@app.get('/admin', include_in_schema=False)
def admin_page():
  return FileResponse(PUBLIC_DIR / 'admin' / 'admin.html')


# Mounted last so the /api routes above take priority.
app.mount('/', StaticFiles(directory=PUBLIC_DIR, html=True), name='static')
