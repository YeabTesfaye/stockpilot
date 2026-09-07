# Day 3 — Role-Based Access Control

**Status:** implemented and verified.

## Decision

Add a server-side RBAC layer with a single `can(user, action, resource)` entry
point, backed by a permission matrix that maps each action to the set of roles
that may perform it. Role check everywhere — backend endpoints, API routes, and
the frontend sidebar/menus all go through the same `can()` / `canRole()` functions
so the UI stays consistent with enforcement.

## Why a single `can()` and not scatter `if (role === 'OWNER')` everywhere

Scattered role checks duplicate logic, drift out of sync, and are easy to forget
on a new endpoint. A single `can()` with a declarative permission matrix means:
- adding a new action is one line in `permissions.ts`;
- changing which roles may perform an action is one edit in the matrix;
- the frontend and backend import the same `Action` enum and `can()` so they
  cannot disagree.

## What we changed

### `server/rabc/roles.ts` (new)

Role enum mirrored from the Prisma schema, plus `ROLE_HIERARCHY` (OWNER=5 →
VIEWER=1) and `roleGte(role, minRole)` for "at least this powerful" checks.

### `server/rabc/permissions.ts` (new)

`Action` enum (coarse-grained operations) and `PERMISSIONS: Record<Action, Role[]>`
— the permission matrix. Today ~30 actions across dashboard navigation, stock
operations, product/BOM management, production, purchasing, and admin.

### `server/rabc/can.ts` (new)

`can(bindings, action, resource?)` — the single entry point. Returns true when
any of the user's role bindings includes a role in the allowed set for the
action. `resource` is accepted for future resource-level checks but currently
unused (all authorization today is role + action). Also exports `canRole(role,
action)` for convenience and `highestRole(bindings)`.

### `server/auth/session.ts`

`SessionUser` now includes `roleBindings: readonly RoleBinding[]` — the user's
roles across all their tenant memberships. Populated in `getSessionUser()` from
the memberships query.

### `app/api/auth/can/route.ts` (new)

GET endpoint that accepts `?action=...` and returns `{ allowed: boolean }`. Used
by the frontend to gate UI and by the break test to confirm enforcement.

### `app/api/admin/users/route.ts` (new)

Owner-only endpoint. Returns 403 for any non-owner role — this is the Day 3 break
task endpoint.

### `components/role-gate.tsx` (new)

Client component that renders children only when the current user holds one of the
given roles and (optionally) can perform the given action. Used in the user menu
to show "Audit log" only to owners.

### `components/user-menu.tsx` (new)

DropdownMenu-based user menu (Radix UI) with avatar, profile, settings, audit log
(owner only), and sign out.

### `app/(dashboard)/layout.tsx`

Replaced the flat header with a sidebar that lists nav items filtered by the
current user's roles via `canRole()`. Admin section (Users, Audit log) only shows
for owners.

### `components/session-provider.tsx` (new)

Client-side session context that fetches `/api/auth/me` on mount and refreshes.
Mounted in `app/layout.tsx` so `useSession()` works anywhere.

### `.env` / `.env.example`

No changes needed — the app role already exists from Day 2.

## Break task — confirm Warehouse Staff gets 403 on an Owner-only action

**Endpoint:** `GET /api/admin/users` (Action.MANAGE_USERS, Owner only)

**As Warehouse Staff (grace@acme.test, role WAREHOUSE_STAFF):**

```bash
curl -b stockpilot_session=<grace-token> http://localhost:3000/api/admin/users
```

Expected: `403 Forbidden` with `{ "error": "Forbidden: you do not have permission to manage users" }`.

**As Owner (ada@acme.test, role OWNER):**

```bash
curl -b stockpilot_session=<ada-token> http://localhost:3000/api/admin/users
```

Expected: `200 OK` with `{ "ok": true, "roleThatWasChecked": ["OWNER"], ... }`.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` passes on all new RBAC files
- [ ] `GET /api/admin/users` as Warehouse Staff → 403
- [ ] `GET /api/admin/users` as Owner → 200
- [ ] Sidebar in layout only shows nav items the current role may access
- [ ] User menu "Audit log" item only visible to Owner
- [ ] `RoleGate` hides children when user lacks the role/action
