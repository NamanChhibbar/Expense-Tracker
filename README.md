# Expense Tracker

Expense Tracker is a lightweight, single-page web app for recording personal expenses. It supports multiple users without authentication. Select a user from the header, or create one.

## Features

- Create users, each with a display name, an emoji and a currency.
- Switch between users from the header.
- Add expenses with a description, amount, category and date.
- Delete expenses.
- View the current month's total and the all-time total for each user.

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

The app is then available at http://localhost:8000. Interactive API documentation is available at http://localhost:8000/docs.

## Configuration

These environment variables override the defaults:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_PATH` | `data/expenses.db` | Location of the SQLite database file. It is created on first run. |
| `PUBLIC_DIR` | `public` | Folder containing the frontend files. |

Categories, currencies and other defaults are defined in `backend/config.py`.

To back up your data, copy the database file while the server is stopped.

## Deployment

The following steps deploy the app to a Google Compute Engine `e2-micro` VM. This machine type is included in the Google Cloud free tier in the `us-west1`, `us-central1` and `us-east1` regions. Check the current [free tier terms](https://cloud.google.com/free) before deploying.

A VM is recommended over Cloud Run. Cloud Run does not keep local files between instance restarts, so the SQLite database would be lost.

1. Create the VM and allow HTTP traffic:

   ```bash
   gcloud compute instances create expense-tracker \
     --zone=us-central1-a --machine-type=e2-micro \
     --boot-disk-type=pd-standard --boot-disk-size=30GB \
     --image-family=debian-12 --image-project=debian-cloud \
     --tags=http-server

   gcloud compute firewall-rules create allow-http \
     --allow=tcp:80 --target-tags=http-server
   ```

2. Connect to the VM:

   ```bash
   gcloud compute ssh expense-tracker --zone=us-central1-a
   ```

3. Install the app and run it as a systemd service:

   ```bash
   sudo apt-get update && sudo apt-get install -y git python3-venv
   sudo git clone <repository-url> /opt/expense-tracker
   cd /opt/expense-tracker
   sudo python3 -m venv .venv
   sudo .venv/bin/pip install -r backend/requirements.txt
   sudo mkdir -p data && sudo chown -R www-data:www-data data
   sudo cp deploy/expense-tracker.service /etc/systemd/system/
   sudo systemctl enable --now expense-tracker
   ```

The app is then served over HTTP on port 80 at the VM's external IP address.

## Security

The app has no authentication. Anyone who can reach the server can view, add and delete expenses for every user. Run it only on a trusted network, or put it behind an access control layer such as a reverse proxy with authentication. Use HTTPS for any deployment reachable from the internet.

## Project structure

| Path | Contents |
| --- | --- |
| `backend/app.py` | FastAPI application, routes and error handlers |
| `backend/models.py` | Request models and validation |
| `backend/config.py` | Paths, categories, currencies and defaults |
| `backend/db.py` | SQLite schema and connection helper |
| `backend/requirements.txt` | Python dependencies |
| `public/` | Frontend page, styles and script |
| `deploy/` | systemd service file for VM deployment |

## API reference

All endpoints accept and return JSON. Errors are returned as `{ "error": "message" }`.

| Method | Path | Request body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users` | None | Lists users, plus the available categories and currencies. |
| `POST` | `/api/users` | `{ name, emoji?, currency? }` | Creates a user. User names must be unique. |
| `GET` | `/api/users/{id}/expenses` | None | Lists a user's expenses, newest first. |
| `POST` | `/api/users/{id}/expenses` | `{ description, amount, category?, date? }` | Adds an expense. `date` uses the `YYYY-MM-DD` format and defaults to today. |
| `DELETE` | `/api/expenses/{id}` | None | Deletes an expense. |

Amounts are returned in cents, in the `amount_cents` field.
