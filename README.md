# Rally 🏀

**A shared real-time match companion — where every client derives the same truth, and the server does almost nothing.**

Everyone who opens Rally sees the exact same second of the match. Join with a nickname, see who else is watching, make predictions on key moments, climb a live multiplayer leaderboard against other visitors and deterministic CPU bots. No accounts, no money, no betting — a fan-engagement game.

**▶ Live demo: [rally.lucas-attali.me](https://rally.lucas-attali.me)**
**📖 Full technical write-up: [lucas-attali.me](https://lucas-attali.me/en/projets/rally/write-up)**

---

## The two rules that shape the system

1. **Derive, don't store.** The whole match clock is one fixed timestamp (`baseStartedAt`) in DynamoDB. Current event, loop index, break windows — all modulo arithmetic, computed on demand. The match "runs" 24/7 at zero cost because it doesn't run at all.
2. **The server only carries what cannot be derived.** Presence and picks travel through a WebSocket relay. Everything downstream — bot decisions, correct answers, points, tie-aware ranks — every client computes locally and lands on the same result, bit for bit.

No scoring server. No game loop. Wall-clock differences between clients don't matter, because wall-clock time is never an input to the shared state.

## Architecture

```
            ┌────────────────────────── AWS (eu-west-3, SAM) ─────────────────────────┐
            │                                                                         │
 Browser ───┼─ GET anchor ──► Lambda rally-state ──► DynamoDB RallyState (1 item:     │
   │        │   (Function URL, returns serverNow      the fixed baseStartedAt anchor) │
   │        │    for clock offset sync)                        ▲                      │
   │        │                                                  │ ensure/self-heal     │
   │        │                              EventBridge (1h) ──► Lambda rally-roll     │
   │        │                                                                         │
   └─ WSS ──┼─► API Gateway WebSocket ──► Lambda rally-ws ──► RallyConnections        │
            │   $connect / join / pick /    (pure relay:       RallyNames (atomic     │
            │   $disconnect                 presence + picks,   nickname item-lock)   │
            │                               zero scoring)                             │
            └─────────────────────────────────────────────────────────────────────────┘

 Front: Next.js on Vercel — derives seq/cycle from the shared clock, folds the
 leaderboard client-side via @rally/engine. Graceful fallback to local replay
 if the anchor is unreachable.
```

**Key mechanics**

- **Shared clock (Model B/D)** — clients fetch the anchor once, compute `offset = serverNow − Date.now()`, then derive everything from `Date.now() + offset`. The client interval only repaints; it owns no state.
- **Identity = the connection** — on `pick`, the server stamps the nickname stored against your `connectionId`. Names inside messages are never trusted, so you cannot pick as someone else.
- **Atomic nickname uniqueness** — `join` writes to `RallyNames` with `attribute_not_exists`; DynamoDB serializes conditional writes, so two people claiming the same name in the same millisecond can never both win.
- **Deterministic bots** — a seeded PRNG (xmur3 → mulberry32, 32-bit integer ops) keyed on `(cycleIndex, predictionId, botId)`. Same decisions on every client, zero communication, fresh behaviour every loop.
- **Tie-aware shared ranking** — standard competition ranking (1224), tiebreak by code-unit comparison (not `localeCompare`, which is locale-dependent and would break cross-client determinism).

## Monorepo

```
packages/engine    @rally/engine — pure TypeScript, no I/O: event stream, state folds,
                   prediction resolution, seeded bots, leaderboard. Runs in the browser
                   today, can run in a Lambda tomorrow (V2 server-side validation).
apps/web           @rally/web — Next.js App Router front (Vercel).
apps/backend       AWS SAM project (outside the pnpm workspace): template.yaml,
                   3 Lambdas (state / roll / ws), Node 22 on arm64.
```

## Run it locally

```bash
pnpm install
pnpm --filter @rally/web dev        # http://localhost:3000
```

Without env vars the app runs in **local replay mode** (no shared clock, no multiplayer) — it never breaks. To plug into a deployed backend, set in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_RALLY_STATE_URL=...     # SAM output: StateUrl
NEXT_PUBLIC_RALLY_WS_URL=...        # SAM output: WebSocketUrl
```

## Deploy the backend

```bash
cd apps/backend
sam build && sam deploy             # stack: rally-backend (eu-west-3)
```

Outputs include the public anchor URL and the WSS endpoint. Teardown: `sam delete --stack-name rally-backend`.

## Honest limits (V1) & roadmap

- The pick lock is enforced client-side (on send **and** on receive) — server-side enforcement, reusing `@rally/engine` inside the Lambda, is the V2 hardening.
- The relay keeps no history: join mid-loop and you only see picks sent after you connected, until the next loop resets everyone.
- The demo is a **replay** of the 2019 FIBA World Cup bronze final (73 verified play-by-play events) and labeled as such — no fake "live". V2 targets real NBA feeds (webhook ingestion, push model, idempotent writes).

**Never in scope:** sports betting or real money, in any form.

---

Personal portfolio project — [Lucas Attali](https://lucas-attali.me) · [LinkedIn](https://www.linkedin.com/in/lucasattali/)