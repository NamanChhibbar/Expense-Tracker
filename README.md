# 🌸 Pocket Petals

A cute pink, single-page expense tracker. No logins: pick who you are from the dropdown, or create a new user.

Backend is FastAPI with SQLite, in `backend/`. The frontend is plain HTML, CSS and JavaScript in `public/`.

## Run locally

```bash
uv venv && uv pip install -r backend/requirements.txt   # or: python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn backend.app:app --reload           # http://localhost:8000, run from the project root
```

Data is stored in `data/expenses.db`, created on first run. Set `DB_PATH` to put it elsewhere. Back it up by copying that file.

Other settings, like categories and currencies, live in `backend/config.py`.

Interactive API docs are at `/docs` while the server runs.

## Deploy on the Google Cloud free tier

The always-free tier includes one `e2-micro` VM in `us-west1`, `us-central1` or `us-east1`, with 30 GB of standard disk. A VM keeps the SQLite file on a persistent disk, so data survives restarts.

```bash
gcloud compute instances create pocket-petals \
  --zone=us-central1-a --machine-type=e2-micro \
  --boot-disk-type=pd-standard --boot-disk-size=30GB \
  --image-family=debian-12 --image-project=debian-cloud \
  --tags=http-server

gcloud compute firewall-rules create allow-http --allow=tcp:80 --target-tags=http-server

gcloud compute ssh pocket-petals --zone=us-central1-a
```

On the VM:

```bash
sudo apt-get update && sudo apt-get install -y git python3-venv
sudo git clone <your-repo-url> /opt/pocket-petals
cd /opt/pocket-petals
sudo python3 -m venv .venv && sudo .venv/bin/pip install -r backend/requirements.txt
sudo mkdir -p data && sudo chown -R www-data:www-data data
sudo cp deploy/pocket-petals.service /etc/systemd/system/
sudo systemctl enable --now pocket-petals
```

The app is then served at the VM's external IP over plain HTTP. There is no login, so anyone with the IP can see and edit expenses.

Avoid Cloud Run with this setup. Its disk is wiped whenever an instance restarts or scales, which would delete the SQLite file.

## Project layout

| Path | Contents |
| --- | --- |
| `backend/app.py` | FastAPI app, routes and error handlers |
| `backend/models.py` | Request models and validation |
| `backend/config.py` | Paths, categories, currencies and defaults |
| `backend/db.py` | SQLite schema and connection helper |
| `public/` | Frontend page, styles and script |
| `deploy/` | systemd unit for the VM |

## API

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/users` | |
| POST | `/api/users` | `{ name, emoji?, currency? }` |
| GET | `/api/users/:id/expenses` | |
| POST | `/api/users/:id/expenses` | `{ description, amount, category, date }` |
| DELETE | `/api/expenses/:id` | |
