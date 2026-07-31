# Inventory Offline Support & Sync — Design

**Date:** 2026-07-31
**Status:** Approved for planning
**Scope:** Inventory module only (the generic-record based item-tracking feature: item name, description, quantity, distributed school, date of submission, remarks/comments, image). Students and other modules remain online-only. The offline layer is built as a reusable pattern other modules can adopt later, but no other module is touched in this phase.

## Problem

Creaspark's Inventory feature (`apps/web` Next.js frontend talking to the NestJS API in `apps/api`, backed by Postgres via Supabase) currently requires a live network connection for every read and write. School storekeepers often work in locations with unreliable or no internet. The app must:

1. Load and remain usable (view existing inventory, add/edit/remove items, including photo capture) with **zero connectivity**.
2. Automatically **synchronize** any offline changes to the server, and pull down any server-side changes, as soon as connectivity returns — with no manual "sync" step required from the user.

## Architecture

The web app already depends on `@tanstack/react-query` (v5) for data fetching. Rather than introducing a separate offline database engine (Dexie, RxDB, WatermelonDB), this design uses React Query's native offline primitives, which already provide:

- Query cache persistence (survives reload, works offline).
- Mutation pausing when offline, with automatic replay on reconnect (`networkMode: 'offlineFirst'`).
- Persisted mutation queue (a queued mutation survives closing the tab while offline).

A minimal service worker (via **Serwist**, the maintained successor to `next-pwa`, compatible with Next.js 15 App Router) precaches the app shell (JS/CSS/static assets for visited routes) so the page itself can load with no network after a first online visit.

This keeps the amount of new custom code small and keeps the app on a library it already uses, rather than adding a second, competing state-management/caching system.

### Rejected alternatives

- **Custom IndexedDB (Dexie.js) + hand-rolled outbox queue** — full manual control over sync semantics, but re-implements what React Query's persistence + `networkMode` already does. More surface area to maintain for no functional benefit at this scale (single-tenant-per-device, low write volume).
- **RxDB / WatermelonDB** — full local-first frameworks with built-in multi-client replication protocols. Significant bundle size and learning-curve cost; designed for continuous multi-writer sync scenarios more complex than "one storekeeper's device goes offline and comes back."

## Components

| Component | Location | Purpose |
|---|---|---|
| Query cache persister | `apps/web/src/lib/offline/persister.ts` | Persists the React Query cache to IndexedDB (via `idb-keyval`) so cached inventory data survives reload and is available with no network. |
| Connectivity manager | `apps/web/src/lib/offline/onlineManager.ts` | Overrides React Query's default `onlineManager` with a real connectivity check (a lightweight `HEAD` ping), since `navigator.onLine` alone is unreliable (true when connected to a network with no real internet). |
| Sync status hook | `apps/web/src/lib/offline/useSyncStatus.ts` | Exposes `{ isOnline, pendingCount, failedCount }` by reading the mutation cache and connectivity manager. |
| Sync badge | `apps/web/src/components/offline/SyncBadge.tsx` | Small UI indicator on the Inventory page: "Offline — 3 changes pending" / "Syncing…" / "All changes synced" / "2 failed — tap to retry". |
| Service worker | `apps/web/src/app/sw.ts` + Serwist Next config | Precaches the app shell so the Inventory route loads offline after a first visit. |
| Idempotent create endpoint | `apps/api/src/modules/records/records.service.ts`, `records.dto.ts` | Accepts a client-generated record ID and upserts by ID, so a retried/replayed create mutation can never produce a duplicate row. |

## Data flow

1. **Initial load (online):** Inventory list/detail queries populate the React Query cache as normal; the persister mirrors that cache into IndexedDB in the background.
2. **Going offline:** the connectivity manager detects the drop. Existing cached data remains renderable. The sync badge switches to "Offline".
3. **Offline create/update/delete:** the mutation applies **optimistically** to the local cache immediately (UI reflects the change instantly) and is queued by React Query (`networkMode: 'offlineFirst'` pauses it rather than failing it). The persister keeps the queued mutation on disk, so it survives a tab close/reopen while still offline.
4. **Photo capture offline:** the image is compressed client-side (max ~800px edge) and embedded as a base64 data URL inside the queued mutation payload (mutation payloads must stay JSON-serializable to persist). On sync, the base64 is decoded and uploaded through the existing image-upload flow, and the record is updated with the returned URL.
5. **Reconnect:** the connectivity manager flips to online; React Query automatically replays queued mutations against the API, in the order they were created.
6. **Server reconciliation:** after mutations replay, affected queries are invalidated and refetched, pulling in any changes made server-side (e.g. by another device) while this one was offline.
7. **Conflict resolution:** **last-write-wins by `updatedAt`.** If the same record was edited both offline (this device) and online (another device/user) during the outage, whichever write reaches the server later wins; there is no merge UI. This is an explicit, accepted tradeoff — inventory records here are typically owned/edited by one storekeeper at a time, so true concurrent conflicting edits are expected to be rare.

## Idempotent create

Today `RecordsService.create()` calls `prisma.genericRecord.create()` with a server-generated ID. Offline, a create mutation may reach the server successfully but the client never receives the response (e.g. connectivity drops mid-response) before being replayed again later. To make replay safe:

- The client generates the record's ID (UUID) at creation time, before going into the queue.
- `RecordDataDto` gains an optional `id` field.
- `RecordsService.create()` becomes an **upsert by id**: if a record with that ID already exists for the tenant/module, the create is a no-op (returns the existing row) instead of erroring or duplicating.

## Error handling

- Mutation replay uses React Query's built-in retry with a capped count and exponential backoff (not infinite).
- After retries are exhausted (e.g. genuine validation failure, or the record was deleted server-side by someone else), the mutation is marked **failed**, not silently dropped. The sync badge surfaces a "N failed" state; the user can retry or discard each failed item from a small pending-changes panel.
- Auth: Supabase's session (access + refresh token) is already persisted client-side by `supabase-js`, so a previously logged-in user's session remains available offline. If the access token expires while offline (default ~1h), queued mutations simply stay paused until reconnect triggers a silent refresh — no data loss, just delayed sync.

## Explicitly out of scope for this phase

- Any module other than Inventory (Students, Attendance, Fees, Announcements, etc.).
- A merge UI for conflicting concurrent edits.
- Delta/incremental sync (`since` timestamp filtering) — the Inventory dataset per school is small enough that a full refetch on reconnect is acceptable; noted as a future optimization if the dataset grows.
- Multi-tab coordination beyond what React Query's shared cache already provides.

## Testing

- **Playwright E2E:** toggle the browser to offline (CDP network emulation), create and edit an inventory item (including a photo) while offline, go back online, assert the item lands correctly on the server and the sync badge clears.
- **API unit test:** submitting the same client-generated `id` twice to the create endpoint results in exactly one row.
- **Unit test:** mutations pause when the connectivity manager reports offline and replay in order once it reports online (mocked).
