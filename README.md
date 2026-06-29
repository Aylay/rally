# Rally

A real-time sports **match companion** — a second-screen app where fans predict key moments of a live game, earn points, and climb a live leaderboard. Basketball first. Zero money, zero betting.

> 🚧 Work in progress — a portfolio & learning project.

## Why this exists

Rally demonstrates, end to end: **real-time event-driven architecture**, an **event-sourced** data model, and **gamified fan engagement** — on a serverless AWS backend with a Next.js front.

## Core idea

The whole app derives from a single **append-only stream of match events**. Score, player points, period and the live leaderboard are never stored as truth — they are recomputed by *folding* the event stream. The match replays on an **authoritative server clock** and **loops continuously**, so the experience is live 24/7 even when no real game is on.

## Architecture in one breath

- **Event sourcing** — append-only events ordered by `sequence`; state is a fold over the stream.
- **Shared broadcast (Model B)** — one server clock; every connected client sees the same moment.
- **Snapshot + live** — a newcomer receives a snapshot (the fold up to *now*), then single events live. The same primitive (`applyEvent`) powers both.
- **Planned cloud** — Vercel (front) + AWS (Lambda, API Gateway WebSocket, DynamoDB, EventBridge Scheduler).

## Tech stack

TypeScript · React / Next.js *(front, in progress)* · AWS *(backend, planned)* · pnpm

## Run the engine locally

```bash
pnpm install
pnpm start     # fold the event stream → derived state + a point-in-time snapshot
pnpm tick      # the heartbeat: the match advances beat by beat, looping forever
pnpm client    # proves a late-joining client converges with an early one
pnpm predict   # predictions resolve from derived state → leaderboard
```

## Seed match

France vs. Australia — bronze-medal game, 2019 FIBA World Cup (France won 67–59), chosen for its dramatic momentum swing. Live NBA data comes in v2.

## Status

- [x] Event-sourcing core (fold, snapshot)
- [x] Heartbeat loop (server clock, infinite replay)
- [x] Snapshot-on-join + live broadcast (client convergence)
- [x] Predictions + per-cycle leaderboard
- [ ] React / Next.js front
- [ ] AWS backend (WebSocket, DynamoDB, EventBridge)
- [ ] Live data via API (NBA) — v2