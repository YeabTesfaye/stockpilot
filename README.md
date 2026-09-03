# StockPilot

Inventory intelligence for small manufacturers — a lightweight MRP system that
tells you what you can build, what you're short on, what to buy, and when
you'll run out. Fully deterministic: no LLM in the core engine.

## Problem

Small manufacturers plan production and purchasing from spreadsheets or gut
feel. They can't quickly answer "can we fulfill this order?", "what should we
buy right now?", or "which orders are at risk?" — and the moment two people
touch inventory at the same time, spreadsheets silently go wrong.

## Solution

StockPilot models the manufacturing domain directly — products, materials,
bills of materials, warehouses, suppliers, and an immutable stock-movement
ledger — and answers those questions with explainable, deterministic
calculations instead of a black box.

## Architecture

[Insert your architecture.png here]

- Next.js (App Router) — UI + REST API via Route Handlers
- PostgreSQL — source of truth, tenant isolation via Row-Level Security
- Redis + BullMQ — background jobs (recommendation generation, reorder-point
  refresh, notifications), run as a separate worker process
- Docker Compose — local dev parity with production

## Features

- Multi-tenant, role-based access (Owner / Production Manager / Purchasing /
  Warehouse Staff / Viewer)
- Bill-of-materials–driven "max buildable units" calculation
- Sales-order → material-requirements explosion with shortage detection
- Automated purchase recommendations and supplier ranking
- Reorder-point engine (lead-time demand + safety stock)
- Simple moving-average demand forecasting
- Heuristic production scheduling across machines
- Immutable stock-movement ledger with concurrency-safe reservations
- Full audit log, structured logging, health/readiness checks

## Tech Stack

TypeScript, Next.js, PostgreSQL, Prisma, Redis, BullMQ, Docker

## Setup

\`\`\`bash
docker compose up -d
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
npm run dev        # web
npm run worker      # background jobs, separate process
\`\`\`

## Testing

\`\`\`bash
npm test              # unit + integration
npm run test:race     # the concurrent stock-reservation test — see docs/writeups
\`\`\`

## Deployment

[describe your actual deploy target and steps]

## Security Considerations

- Tenant isolation enforced at the database layer via PostgreSQL RLS, not
  only in application code
- Passwords hashed with argon2; sessions are server-side and revocable
- Every mutation is permission-checked through a single `can()` function and
  recorded in an append-only audit log
- [add anything specific you found/fixed during your Week 4 security pass]

## Performance Considerations

- [insert your actual load-test numbers from Week 4]
- Inventory reservation uses row-level locking (`FOR NO KEY UPDATE`) scoped
  to a single material+warehouse row, chosen over `FOR UPDATE` because the
  operation only changes a quantity, not a key column — see
  docs/writeups/concurrency-case-study.md for the full reasoning and test.

## Tradeoffs

- Shared-schema + RLS multi-tenancy chosen over schema-per-tenant for
  operational simplicity at this scale; documented migration path if a
  future tenant needs dedicated isolation.
- Production scheduling is a greedy heuristic (earliest-due-date first),
  not an optimizer — documented as a known limitation, not hidden.
- BOMs are single-level in v1; multi-level (sub-assembly) explosion is
  future work.

## Future Improvements

- Multi-level BOM explosion with cycle detection
- Exponential smoothing / seasonality in forecasting
- Optimization-based (not greedy) production scheduling
- StockPilot 2.0: an optional AI layer on top of this deterministic core —
  a natural-language interface that calls the existing planning endpoints,
  framed explicitly as an assistant layer, not a replacement for the engine.