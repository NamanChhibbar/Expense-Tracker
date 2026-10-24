# Expense Tracker

Expense Tracker is a lightweight, single-page web app for recording personal expenses. It supports multiple users without authentication. Select a user from the header, or create one.

## Features

- Create users, each with a display name and a currency.
- Switch between users from the header.
- Add expenses with a description, amount, category and date.
- Edit and delete expenses.
- View the current month's total and the all-time total for each user.
- See every user with their expense count and totals, and delete users, on the admin page at `/admin`.

## Tech stack

- **Backend:** Python, FastAPI and SQLite.
- **Frontend:** Plain HTML, CSS and JavaScript, with no build step.

## Requirements

- Python 3.10 or newer.
- [uv](https://docs.astral.sh/uv/) is optional. The standard `venv` and `pip` tools work as well.

## Getting started

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd <repository-folder>

python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

With uv, the install step is:

```bash
uv venv
uv pip install -r backend/requirements.txt
```

Start the development server from the project root:

```bash
.venv/bin/uvicorn backend.app:app --reload
```

The app is then available at <http://localhost:8000>. Interactive API documentation is available at <http://localhost:8000/docs>.

## Configuration

Paths, categories, currencies and other defaults are defined in `backend/config.py`. The database is stored at `data/expenses.db` and is created on first run.

To back up your data, copy the database file while the server is stopped.

## Deployment

The app can run on any Linux server with Python 3.10 or newer. The repository includes a systemd service file in `deploy/` that starts the app at boot and restarts it if it stops.

Choose a host with persistent storage. The database is a local SQLite file, so platforms that reset the filesystem on restart will lose all data.

1. Install the app on the server:

   ```bash
   sudo git clone <repository-url> /opt/expense-tracker
   cd /opt/expense-tracker
   sudo python3 -m venv .venv
   sudo .venv/bin/pip install -r backend/requirements.txt
   sudo mkdir -p data && sudo chown -R www-data:www-data data
   ```

2. Install and start the service:

   ```bash
   sudo cp deploy/expense-tracker.service /etc/systemd/system/
   sudo systemctl enable --now expense-tracker
   ```

The app is then served over HTTP on port 80. Make sure the server's firewall allows incoming traffic on that port.

If you install the app in a different folder, or want a different port or user, edit the service file before copying it.

To manage the service:

```bash
sudo systemctl status expense-tracker     # check whether it is running
sudo systemctl restart expense-tracker    # apply code updates
journalctl -u expense-tracker -f          # follow the logs
```

## Security

The app has no authentication. Anyone who can reach the server can view, add and delete expenses for every user, and use the admin page at `/admin` to delete any user. Run it only on a trusted network, or put it behind an access control layer such as a reverse proxy with authentication. Use HTTPS for any deployment reachable from the internet.

## Project structure

| Path | Contents |
| --- | --- |
| `backend/app.py` | FastAPI application, routes and error handlers |
| `backend/models.py` | Request models and validation |
| `backend/config.py` | Paths, categories, currencies and defaults |
| `backend/db.py` | SQLite schema and connection helper |
| `backend/requirements.txt` | Python dependencies |
| `public/` | Frontend pages (tracker and admin), styles and scripts |
| `deploy/` | systemd service file for server deployment |

## API reference

All endpoints accept and return JSON. Errors are returned as `{ "error": "message" }`.

| Method | Path | Request body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users` | None | Lists users, plus the available categories and currencies. |
| `POST` | `/api/users` | `{ name, currency? }` | Creates a user. User names must be unique. |
| `GET` | `/api/users/{id}/expenses` | None | Lists a user's expenses, newest first. |
| `POST` | `/api/users/{id}/expenses` | `{ description, amount, category?, date? }` | Adds an expense. `date` uses the `YYYY-MM-DD` format and defaults to today. |
| `PUT` | `/api/expenses/{id}` | `{ description, amount, category?, date? }` | Updates an expense. Omitted optional fields fall back to their defaults. |
| `DELETE` | `/api/expenses/{id}` | None | Deletes an expense. |
| `GET` | `/api/admin/users` | None | Lists every user with `expense_count`, `total_cents`, `last_spent_on` and `created_at`. |
| `DELETE` | `/api/admin/users/{id}` | None | Deletes a user and all of their expenses. |

Amounts are returned in cents, in the `amount_cents` field.
