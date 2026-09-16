# Ingenero 360AI Dashboard — Setup & Run Guide

How to get this dashboard running on another machine. The app is **two processes**:

| Process | What | Port | Where |
|---|---|---|---|
| **Next.js** (frontend + server actions) | UI, BFF proxy | `3000` | `Dashboard/` |
| **FastAPI** (Python data backend) | heavy data processing, config save/load | `8000` | `Dashboard/services/app/` |

The Next.js layer proxies data calls to FastAPI via `FASTAPI_INTERNAL_URL` (defaults to `http://localhost:8000`). Both must be running.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22.x** | build image base is `node:22-alpine` (see [`Dockerfile`](../../../Dockerfile)). No `.nvmrc` is committed — any Node 22 works. |
| npm | 10+ (ships with Node 22) | |
| Python | **3.11** | pinned in [`.python-version`](../../../.python-version) |
| `uv` (recommended) | latest | fast Python env/installer — `pip install uv` or see astral.sh/uv |

---

## 2. Get the code onto the other machine

```bash
git clone <your-repo-url>
cd <repo>/Dashboard
```

> ⚠️ **State files are not in git history reliably.** The dashboard reads/writes runtime data on the filesystem (not just a DB). If you want the **saved configs** to come across too, copy these directories from the source machine:
> - `services/app/routers/ammoniaReformerConfig/outputs/` — saved system configs (`system_config_*.json`), PI mappings (`pi_mapping_*.json`), exports
> - `services/app/routers/ammoniaReformerConfig/inputs/` — blueprints (`Blueprint_*.xlsx`) and other input artifacts
>
> Without these, the app starts clean (empty config list).

---

## 3. Frontend (Next.js)

```bash
# from Dashboard/  (ensure Node 22 is active, e.g. `nvm use 22`)
npm install             # installs deps; runs `prisma generate` postinstall
```

**Caveat:** the `postinstall` hook runs `prisma generate`, which needs `prisma/schema.prisma` and a `DATABASE_URL`. This tree currently has **no `prisma/schema.prisma`**, so the hook may warn/fail. If `npm install` errors only on the prisma step, run:

```bash
npm install --ignore-scripts
```

The dashboard's core flows (config build, save/load) go through FastAPI + the filesystem, not Prisma, so this does not block local use.

### Run it

```bash
# Development (hot reload, binds all interfaces)
npm run dev            # http://localhost:3000

# Production
npm run build
npm run start          # http://localhost:3000
```

---

## 4. Backend (FastAPI)

The Python server has **no `__main__` block**, so launch it with `uvicorn`. Its imports are relative to `services/app/`, so **cwd must be `services/app/`**.

```bash
# from Dashboard/ — create the virtual env (uv recommended)
uv venv --python 3.11                       # creates Dashboard/.venv
uv pip install -r services/requirements.txt

# or with stock tooling:
# python3.11 -m venv .venv
# .venv/bin/pip install -r services/requirements.txt
```

### Run it

```bash
# from Dashboard/
cd services/app
../../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

# or, with the venv activated (source ../../.venv/bin/activate):
# uvicorn main:app --host 0.0.0.0 --port 8000

# add --reload during development
```

Health check: `curl http://localhost:8000/api/health` → `{"status":"ok",...}`

> Some Python deps (`CoolProp`, `pyarrow`, `polars`) compile native wheels — first install can be slow. If a PI historian connection is needed, also install the optional auth backend noted in [`services/requirements.txt`](../../../services/requirements.txt) (`requests-kerberos` or `requests-ntlm`).

---

## 5. Environment variables

Env files (`.env*`) are git-ignored, so they do **not** transfer with the repo — recreate as needed. Create `Dashboard/.env` (or `.env.local`):

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `FASTAPI_INTERNAL_URL` | optional | `http://localhost:8000` | where Next.js reaches FastAPI. Only set if the backend runs on another host/port. |
| `DATABASE_URL` | only if using Prisma/DB | — | Postgres connection string; referenced by [`prisma.config.ts`](../../../prisma.config.ts). Not required for the core file-based config flows. |

The FastAPI CORS config currently allows only `http://localhost:3000` ([`services/app/main.py`](../../../services/app/main.py)). If you serve the frontend from a different origin, add it to `allow_origins`.

---

## 6. Quick start (TL;DR)

Two terminals, from `Dashboard/`:

```bash
# Terminal 1 — backend
uv venv --python 3.11 && uv pip install -r services/requirements.txt
cd services/app && ../../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend  (Node 22 active)
npm install            # (or: npm install --ignore-scripts)
npm run dev
```

Open **http://localhost:3000** → redirects to `/ammoniaReformerConfig`.

---

## 7. Where saved files land (reminder)

Both the **System Config** save and the **KPI Applicability / sensor-mapping** save write into:

```
Dashboard/services/app/routers/ammoniaReformerConfig/outputs/
```

Filenames are derived from system + plant name (`system_config_<sys>_<plant>.json`, `pi_mapping_<sys>_<plant>.json`) and **overwrite** in place on re-save. Back up this folder to preserve work across machines.

---

## 8. Docker (exists, but currently incomplete)

The repo ships a [`Dockerfile`](../../../Dockerfile), [`docker-compose.yml`](../../../docker-compose.yml), and an Azure `startup.sh`. **The manual two-process flow above is the recommended path** — the Docker setup does not build as-is. Known gaps to fix before relying on it:

- **No `services/Dockerfile`** — the compose `api` (FastAPI) service has `build.context: ./services` but there's no Dockerfile there, so it won't build.
- **No `prisma/` directory** — the web `Dockerfile` does `COPY prisma ./prisma` and `npm ci` runs `prisma generate`; both fail without a committed `prisma/schema.prisma`.
- **Wrong env var name** — compose sets `FASTAPI_URL`, but the code reads `FASTAPI_INTERNAL_URL` ([`src/shared/libs/FastApiClient.ts`](../../../src/shared/libs/FastApiClient.ts)). In Docker the web container must also reach the api container by service name, i.e. `FASTAPI_INTERNAL_URL=http://api:8000` (not `localhost`).

> 🔐 **Secrets warning.** `docker-compose.yml` and `Dockerfile` currently contain **hardcoded credentials** (a live `DATABASE_URL` with password/host and a `JWT_SECRET`). Do **not** distribute these as-is. The export script (§9) redacts them automatically in the exported copy; move them to a git-ignored `.env` / compose `env_file` in the source too.

---

## 9. Making a transportable copy (`export-dashboard.sh`)

To produce a clean folder you can copy to another machine (no `node_modules`, `.venv`, `.next`, `.git`, or secrets), run the helper that lives next to this file:

```bash
# from Dashboard/
./src/app/ammoniaReformerConfig/export-dashboard.sh [DEST_DIR]
```

- Default `DEST_DIR` is `../Dashboard_export` (a sibling of `Dashboard/`).
- Includes saved state (`outputs/` + `inputs/`) by default; set `INCLUDE_STATE=0` to ship clean.
- Set `ARCHIVE=1` to also produce a `.tar.gz`.
- Redacts `DATABASE_URL` / `JWT_SECRET` values from `docker-compose.yml` and `Dockerfile` in the copy.

On the target machine, the bundle has `SETUP.md` at its root — start there.
