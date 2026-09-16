# PeRefDCU — Developer Setup SOP

Follow these steps in order. Do them once on a new machine.

---

## Prerequisites

- Git installed
- Python installed
- Node.js v26.3.1 portable folder — get this from the team lead (no installer needed)

---

## Step 1 — Place Node.js v26

Copy the Node v26 folder shared by the team lead to a fixed location on your machine.
Recommended path: `C:\node-v26.3.1-win-x64`

---

## Step 2 — Clone the repo directly to the integration branch

```cmd
git clone -b integration/PeRefDCU https://<YOUR-PAT>@dev.azure.com/devingenero/Product%20Development/_git/Product%20Development
```

Replace `<YOUR-PAT>` with your Azure DevOps Personal Access Token.
This clones the repo and checks out `integration/PeRefDCU` in one step.

---

## Step 3 — Install Node dependencies

Open a terminal inside the cloned repo root (`Product%20Development`):

```cmd
set PATH=C:\node-v26.3.1-win-x64;%PATH%
npm install --ignore-scripts
```

> `--ignore-scripts` skips `prisma generate` which requires `.env` — we do that in Step 5.

---

## Step 4 — Protect shared files from accidental commits

Two shared platform files will have local-only changes made during setup. They must be hidden from git so they are never accidentally committed or included in your PR.

**`package-lock.json`** — Running `npm install` with Node v26 causes a 1-line normalisation (`"dev": true` removed from the `fsevents` entry). This is a deterministic npm 11 behaviour on a lockfile originally generated with an older npm. It is not your change to own — the platform team will fix it centrally.

**`AGENTS.md`** — This file has a line that scopes the AI agent to a capability. It ships with `oee` as the default. You will change it locally to `PeRefDCU` (Step 5). Since all teams share this file, committing your change would overwrite their scoping.

Ask your AI agent to run these commands, or run them yourself:

```cmd
git update-index --assume-unchanged package-lock.json
git update-index --assume-unchanged AGENTS.md
```

After this, `git status` will show a clean working tree even with these local changes present.

---

## Step 5 — Update AGENTS.md (local only — do not commit)

`AGENTS.md` ships with `oee` as the capability name. Your AI agent needs this changed to `PeRefDCU` so it stays scoped to your folders and does not touch other teams' code.

Ask your AI agent to update `AGENTS.md`, or do it manually — find this line:

```
i am a capability_dev, for this project `capability_name` is "oee". So your working directory becomes nextjs: `src\app\(authenticated)\instance-explorer\[instance_id]\(dashboard)\oee`, python: `services\app\routers\oee\`
```

Change both occurrences of `oee` to `PeRefDCU`:

```
i am a capability_dev, for this project `capability_name` is "PeRefDCU". So your working directory becomes nextjs: `src\app\(authenticated)\instance-explorer\[instance_id]\(dashboard)\PeRefDCU`, python: `services\app\routers\PeRefDCU\`
```

This change is hidden from commits by Step 4 — it stays local to your machine.

---

## Step 6 — Configure environment

```cmd
copy .env.example .env
```

Open `.env` and fill in the values. Get credentials from the lead.

> Never commit `.env` — it is gitignored.

Optional (PeRefDCU dev only) — add this line to your local `.env` to show Blueprint Manager / Model Manager in the sidebar. Leave it unset for production-like behavior; these views move to a separate app in Phase 2:

```
NEXT_PUBLIC_PEREFDCU_SHOW_ADMIN_TOOLS=true
```

---

## Step 7 — Generate Prisma client

```cmd
set PATH=C:\node-v26.3.1-win-x64;%PATH%
npx prisma generate
```

---

## Step 8 — Set up Python backend

```cmd
python -m venv services/venv
.\services\venv\Scripts\activate.bat
pip install -r services/requirements.txt
```

---

## Step 9 — Bat files

The two bat files in this folder (`start_frontend.bat` and `start_backend.bat`) start both servers. Their `cd` path is relative to the bat file's own location, so they work regardless of which drive/folder you cloned the repo to.

`start_frontend.bat` already defaults to the recommended Node path from Step 1:

```bat
set NODE_PATH=C:\node-v26.3.1-win-x64
```

Only edit this line if you placed Node v26 somewhere other than that recommended path.

---

## Step 10 — Start the servers

Double-click both bat files (each opens in its own terminal):

| File | Server | URL |
|---|---|---|
| `start_backend.bat` | FastAPI | http://localhost:8000 |
| `start_frontend.bat` | Next.js | http://localhost:3000 |

Verify setup: open http://localhost:8000/api/health — should return `{"status": "healthy"}`.

---

## Notes

- Never commit directly to `develop` — raise a PR from `integration/PeRefDCU` into `develop`.
- Your working scope is `src/app/(authenticated)/instance-explorer/[instance_id]/(dashboard)/PeRefDCU/` and `services/app/routers/PeRefDCU/` — do not touch other teams' folders.
- `npm run dev` runs `prisma generate` automatically on every start — no need to run it manually after initial setup.

---

## AI Agent Rules (read before starting any task)

If you use an AI coding agent (Claude or similar), share these rules at the start of every session so the agent stays strictly within scope.

Before starting any implementation task, instruct your agent to read the following files for full context and details:
- `AGENTS.md` — coding conventions, architecture, styling rules, project structure
- `documentation/00_getting_started.md` — platform overview and contracts
- `documentation/01_capability_onboarding.md` — onboarding, dependency rules, platform setup
- `documentation/02_instance_id_and_routing.md` — how `instance_id` flows and routing contracts
- `documentation/03_historian_pi_data.md` — PI data access via historian
- `documentation/04_configuration_draft.md` — draft autosave pattern
- `documentation/05_configuration_submission.md` — final config submission pattern
- `documentation/06_model_files_registry.md` — model file upload/retrieval
- `documentation/07_database_verification.md` — verifying DB writes

### Scope
- You are a `capability_dev` for `PeRefDCU`.
- **Next.js working directory:** `src/app/(authenticated)/instance-explorer/[instance_id]/(dashboard)/PeRefDCU/`
- **Python working directory:** `services/app/routers/PeRefDCU/`
- Never read, edit, or create files outside these two directories unless explicitly instructed.

### Hard Rules
- Never create files without user approval.
- Never touch other teams' capability folders.
- Never commit directly to `develop` — PR only.
- Never modify `services/app/main.py`, `prisma/schema.prisma`, or any file in `src/shared/libs/` — these are platform-level files owned by the central team.
- Never change an existing version in `services/requirements.txt` without central team approval. New packages may be added, pinned with `==`.
- Never commit `package-lock.json` or `AGENTS.md` — both are marked `assume-unchanged`.

### Git Rules
- Always work on `integration/PeRefDCU`.
- Sync with `develop` using merge (not rebase): `git fetch origin develop && git merge origin/develop`.

### Next.js Coding Rules
- Use **Zod** for validation, **Jotai** for state management, **server actions** for data mutations.
- Query the database directly inside async React Server Components — never use server actions for data fetching.
- Use shared providers — do not create your own instances:
  - Prisma: `src/shared/libs/prisma/Prisma.ts`
  - Jotai: `src/shared/libs/jotai/JotaiProvider.ts`
  - FastAPI client: `src/shared/libs/FastApiClient.ts`
- Browser never calls FastAPI directly — always proxy via a server action.
- Use **Tailwind v4 semantic tokens only** — no raw colors (`bg-blue-500`), no hex, no CSS variables. Use tokens defined in `src/app/globals.css` under `@theme`.
- Use `src/shared/components/PageGuard.tsx` for page-level access control, `RequireAccess` for element-level.
- All server actions must validate input with Zod before any Prisma call.
- Hardcoded/mock data → `shared/data`. Utility functions → `shared/utils`.
- Use **React Hook Form** (`useForm`/`useController`) for all form handling.
- Global Jotai state → `src/shared/store/`. Component-level atoms → `PeRefDCU/**/store/`.

### Python Coding Rules
- All backend code in `services/app/routers/PeRefDCU/`.
- Create a `router.py` with `APIRouter(prefix="/api/your-feature")`, expose via `__init__.py`.
- Never make direct DB calls from Python — persistence is handled by Next.js server actions via Prisma. Python handles heavy compute and data processing only.
- Add new dependencies to `services/requirements.txt` pinned with `==`. Never change existing versions.
