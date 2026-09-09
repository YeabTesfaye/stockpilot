# Concurrency case study — stock reservation race

## Problem

Two operators reserve stock against the same material at the same time.
Without locking, both read the same `available = current_stock − reserved_qty`,
both decide there is enough, and both increment `reserved_qty`. The result is a
double-commit: the material ends up with `reserved_qty` that exceeds what is
actually available, and the next shipment dispatches stock that isn't there.

This is the classic *check-then-act* race. The fix must make the read + check +
write atomic with respect to other writers on the same material.

## Approaches considered

### 1. Optimistic concurrency (version column)

Add a `version` integer to materials. Read it, check the quantity, then
`UPDATE materials SET reserved_qty = $1, version = version + 1 WHERE id = $2
AND version = $3`. If the `UPDATE` affects 0 rows, someone else mutated the row
first and we retry.

**Pros:** no explicit locking, works well under low contention.
**Cons:** retry logic, and under high contention you can get hot-row thrashing.
For a warehouse where reservations are frequent and the row is small, pessimistic
locking is simpler and more predictable.

### 2. Single atomic UPDATE

`UPDATE materials SET reserved_qty = reserved_qty + $1 WHERE id = $2 AND
(current_stock - reserved_qty) >= $1`. If the `UPDATE` affects 0 rows, the
check failed and we report insufficient stock.

**Pros:** simplest code, no transaction needed, no explicit lock.
**Cons:** the error message is poorer (we don't know the actual available count
without a second query), and adding richer pre-conditions (e.g. warehouse-level
caps, per-batch allocation) becomes awkward inside a single WHERE clause. We
chose the explicit approach so the check error is informative and the logic is
easy to extend.

### 3. Pessimistic row lock with `SELECT ... FOR NO KEY UPDATE` (chosen)

Wrap the read + check + write in a transaction, and `SELECT ... FOR NO KEY
UPDATE` the material row at the start. This acquires a row-level lock that blocks
concurrent writers to the same material. The second transaction waits for the
first to commit, then re-reads the row and finds the updated `reserved_qty`.

**Why `FOR NO KEY UPDATE` instead of `FOR UPDATE`?**

- `FOR UPDATE` takes a stronger lock that also blocks `SELECT ... FOR KEY SHARE`
  (used by foreign-key checks on referencing tables). That is overkill for a
  quantity bump that doesn't touch the primary key or any unique column.
- `FOR NO KEY UPDATE` is enough to prevent lost updates on the row we're
  writing, and it doesn't block FK-sharing readers. A warehouse with high
  reservation concurrency sees less lock contention with `FOR NO KEY UPDATE`
  than with `FOR UPDATE` for the same workload.
- The only downside: `FOR NO KEY UPDATE` does not block `FOR SHARE` readers,
  which is fine here because we never read reserved_qty in a way that needs
  serializable consistency across multiple rows.

**Why a transaction around the raw SQL?**

- `db.raw.sql` with `FOR NO KEY UPDATE` must be inside a transaction, otherwise
  the lock is released immediately after the SELECT returns and the race window
  is back. We use `db.transaction(async () => { ... })` so the lock is held for
  the duration of the read + check + write.

## Test

See `tests/concurrency/stock-race.test.ts`.

1. Seed a material with `current_stock = 10`, `reserved_qty = 0`.
2. Fire two concurrent `reserveStock()` calls: one for 8 units, one for 7 units.
3. Use `Promise.allSettled` to collect both outcomes.
4. Assert:
   - exactly one resolves (fulfilled)
   - the other rejects with an "Insufficient available stock" error
   - after both settle, `reserved_qty` equals the winning quantity (7 or 8)

The test is rerunnable and runs the race 10 times in a loop to catch intermittent
failures.

## Expected result

With the `FOR NO KEY UPDATE` lock, the first transaction to acquire the lock
reads `available = 10`, succeeds, and commits with `reserved_qty = 8` (or 7).
The second transaction blocks on the lock, then re-reads `available = 2` (or 3),
finds it insufficient for its request, and throws. Exactly one reservation lands.

Without the lock (or with a plain `SELECT` inside the transaction), both
transactions read `available = 10`, both think they can proceed, and both
commit — `reserved_qty` ends up at 15, which is wrong.

## Deadlock safety for transfers

The transfer function (`server/inventory/transfer.ts`) moves stock between two
warehouses. When two transfers run concurrently between the same pair of
warehouses in opposite directions, a naive `SELECT ... FOR NO KEY UPDATE` on
each warehouse in call-order can deadlock: transfer A locks warehouse 1 then
warehouse 2, transfer B locks warehouse 2 then warehouse 1.

The fix: always lock warehouses in **ascending id order**, regardless of
transfer direction. Both transfers then lock warehouse 1 first, then warehouse 2,
and the second one simply waits for the first to commit — no circular wait, no
deadlock.

See `server/inventory/transfer.ts` for the implementation.
