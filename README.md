# Bullyx

Bullyx is a governed policy layer for AI agents. It turns messy operational knowledge into evidence-linked candidate policies, puts a human approval gate in front of execution, evaluates only approved structured rules at runtime, and records every decision in a tamper-evident audit chain.

The included demo models dispute and refund operations at a fintech. It is a complete local vertical slice:

`40 source records → evidence-bound extraction → human review → versioned rulebook → deterministic decision → immutable audit entry`

## Run it

Prerequisites:

- Python 3.11+
- Node.js 20+

From the project directory, run one command:

```powershell
python run.py
```

On the first run, the launcher creates an isolated Python environment and installs backend and frontend dependencies. It then starts both services and opens [http://127.0.0.1:5173](http://127.0.0.1:5173). Press `Ctrl+C` in the terminal to stop everything.

The API and interactive OpenAPI documentation are available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

To reset only the generated demo database and begin a clean walkthrough:

```powershell
python run.py --reset
```

## Offline by default, OpenAI when configured

No API key is required. Without one, `POST /extract` uses a deterministic mock extractor that returns the same evidence-backed policy candidates on every run.

To use the OpenAI provider instead:

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY`.
3. Optionally change `OPENAI_MODEL` (the default is `gpt-5.6-luna`).
4. Run `python run.py` again.

All provider access is isolated in `backend/app/llm.py` behind one `complete()` function. Bullyx uses the Responses API with a strict JSON schema, then validates every cited evidence ID against stored source documents before saving a candidate. Decisions never call an LLM.

## Two-minute demo

**0:00 — Start.** Run `python run.py`. The Policy Inbox opens with 40 seeded Slack messages, tickets, and document fragments available to mine.

**0:15 — Extract.** Click **Extract policies**. Eight candidate rules appear. Open **Inspect evidence** on any card to see the exact source text, author, timestamp, thread, and source ID behind the candidate.

**0:45 — Govern.** Approve **Analyst approval for mid-value provisional credit**. Edit another candidate's natural-language or structured JSON rule and choose **Save & approve**. Approve one or two additional rules. Approved policies leave the inbox and appear in **Active Rulebook** as version 1; editing an active rule creates version 2 with a change note.

**1:15 — Decide.** Open **Active Rulebook**. The form is prefilled with this situation:

```json
{
  "dispute_type": "unauthorized",
  "amount": 320,
  "account_age_days": 200,
  "region": "US",
  "days_since_transaction": 15
}
```

Click **Run governed decision**. Bullyx returns `approve provisional credit`, requires `risk_analyst`, cites the exact policy version and source evidence, and explains why that rule won. The matcher considers only approved policies, chooses the most specific match, and uses the most restrictive action as the tie-breaker.

**1:45 — Prove.** Open **Audit**. The decision appears with its inputs, output, policy version, evidence IDs, previous hash, and entry hash. Click **Verify full chain** to recompute every SHA-256 link from genesis to the current head.

## API examples

Extract policy candidates:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/extract
```

Ask for a governed decision:

```powershell
$body = @{
  dispute_type = "unauthorized"
  amount = 320
  account_age_days = 200
  region = "US"
  days_since_transaction = 15
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/decide `
  -ContentType "application/json" -Body $body
```

Verify the audit chain:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/audit/verify
```

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Provider mode and record counts |
| `GET` | `/sources` | Seeded source library |
| `POST` | `/extract` | Extract evidence-linked candidates |
| `GET` | `/policies?status=...` | Candidate, approved, rejected, or edited policies |
| `POST` | `/policies/{id}/approve` | Approve or edit-and-approve a version |
| `POST` | `/policies/{id}/reject` | Reject a candidate |
| `GET` | `/policies/{id}/history` | Approved version snapshots |
| `POST` | `/decide` | Evaluate approved structured rules |
| `GET` | `/audit` | Read the append-only decision ledger |
| `GET` | `/audit/verify` | Recompute and verify the hash chain |

## Structured rule contract

Rules are data, not executable source code:

```json
{
  "conditions": [
    { "field": "amount", "operator": "gte", "value": 50 },
    { "field": "amount", "operator": "lte", "value": 500 }
  ],
  "action": "approve provisional credit",
  "required_approvals": ["risk_analyst"]
}
```

Supported operators are `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `contains`, and `exists`. Missing fields do not match, comparisons are type-aware, and there is no `eval`, scripting, or model call in the decision path.

## Architecture

```text
bullyx/
├── run.py                         # one-command launcher
├── data/bullyx.db                 # generated SQLite database
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI routes and app factory
│   │   ├── models.py              # SQLAlchemy persistence models
│   │   ├── repositories.py        # replaceable storage boundary
│   │   ├── seed.py                # 40 realistic source records
│   │   ├── llm.py                 # single provider abstraction
│   │   ├── extraction.py          # prompts, mock, evidence validation
│   │   └── rules.py               # deterministic matching and precedence
│   └── tests/
└── frontend/
    └── src/
        ├── components/             # rule and evidence review primitives
        └── views/                  # Inbox, Rulebook, and Audit workflows
```

FastAPI depends on repository objects rather than direct SQL calls. SQLite is the embedded implementation; moving to another SQLAlchemy-backed store does not change extraction, governance, decision, or audit services.

The audit table has no mutation endpoint and SQLite triggers reject `UPDATE` and `DELETE`. Each entry hash is `SHA-256(canonical entry payload + previous hash)`. Verification recomputes both the stored `prev_hash` link and the entry digest in insertion order.

## Verify the build

Backend tests cover type-safe conditions, specificity/restrictiveness precedence, candidate exclusion, the full offline API slice, audit verification, mutation guards, and tamper detection:

```powershell
.\.venv\Scripts\python.exe -m pytest backend
```

Frontend checks:

```powershell
Set-Location frontend
npm run lint
npm run build
```

## Demo boundaries

This MVP intentionally has no authentication, multi-tenant isolation, or distributed locking. The audit append lock is correct for the included single-process local server. A production deployment should add identity and role enforcement at the approval boundary, database-native serializable append semantics, signed releases, migrations, retention controls, and external key management.
