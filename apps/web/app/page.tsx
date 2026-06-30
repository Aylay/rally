"use client";

import { useState, useEffect } from "react";
import { SEED_EVENTS, deriveState, resolve } from "@rally/engine";

// Points par type — AFFICHAGE uniquement (badge +2/+3 du feed). La vérité du score
// vit dans le moteur ; ceci ne sert qu'au feed.
const PTS: Record<string, number> = { shot_2pts: 2, shot_3pts: 3, free_throw: 1 };

const TICK_MS = 1500, PAUSE_MS = 5000, WIN_POINTS = 10;

// Endpoint public de l'anchor (Modèle B). Absent → on reste en replay local (fallback).
const STATE_URL = process.env.NEXT_PUBLIC_RALLY_STATE_URL;
type Anchor = { matchId: string; baseStartedAt: number; lastSequence: number; tickMs: number; pauseMs: number; status: string; serverNow: number };
const C = { bg: "#0a0d12", panel: "#10151d", line: "#202a38", ink: "#f1efe9", muted: "#828c9c",
            fra: "#3b74ff", aus: "#f5c518", live: "#ff5640", win: "#34e29a" };
const TEAMS = [
  { id: "team_fra", name: "France", abbr: "FRA", color: C.fra },
  { id: "team_aus", name: "Australia", abbr: "AUS", color: C.aus },
];
// donnée de référence figée, résolue en mémoire côté front (jamais recopiée ailleurs)
const PLAYERS: Record<string, string> = { player_ntilikina: "Ntilikina", player_fournier: "Fournier", player_batum: "Batum", player_mbaye: "M'Baye", player_gobert: "Gobert", player_decolo: "De Colo", player_poirier: "Poirier", player_albicy: "Albicy", player_labeyrie: "Labeyrie", player_toupane: "Toupane", player_mills: "Mills", player_dellavedova: "Dellavedova", player_ingles: "Ingles", player_kay: "Kay", player_bogut: "Bogut", player_baynes: "Baynes", player_landale: "Landale" };
const PLAYER_TEAM: Record<string, string> = { player_ntilikina: "team_fra", player_fournier: "team_fra", player_batum: "team_fra", player_mbaye: "team_fra", player_gobert: "team_fra", player_decolo: "team_fra", player_poirier: "team_fra", player_albicy: "team_fra", player_labeyrie: "team_fra", player_toupane: "team_fra", player_mills: "team_aus", player_dellavedova: "team_aus", player_ingles: "team_aus", player_kay: "team_aus", player_bogut: "team_aus", player_baynes: "team_aus", player_landale: "team_aus" };
const isTeam = (id: string) => id.startsWith("team_");
const nameOf = (id: string) => TEAMS.find((t) => t.id === id)?.name ?? id;
const colorOf = (id: string) => TEAMS.find((t) => t.id === id)?.color ?? C.line;
const abbrOf = (id: string) => TEAMS.find((t) => t.id === id)?.abbr ?? "";
const labelOf = (id: string) => (isTeam(id) ? nameOf(id) : PLAYERS[id] ?? id);
const shortOf = (id: string) => (isTeam(id) ? abbrOf(id) : PLAYERS[id] ?? id);
const dotColorOf = (id: string) => (isTeam(id) ? colorOf(id) : colorOf(PLAYER_TEAM[id] ?? ""));

const BOTS = [
  { id: "cpu_chalk", name: "Chalk", skill: 0.85 }, // suit le favori au lock
  { id: "cpu_flip",  name: "Flip",  skill: 0.55 }, // pile ou face
  { id: "cpu_rebel", name: "Rebel", skill: 0.30 }, // contrarian
];

// File de prédictions : une carte à la fois. Fenêtres non chevauchantes sur le seed.
// open/lockAtSequence = timing UI en v1 ; ils passeront serveur (lock imposé par la Lambda) en v2.
const PREDICTIONS = [
  { id: "pred_q1_leader", question: "Who leads at the end of Q1?", options: ["team_fra", "team_aus"],
    openAtSequence: 3, lockAtSequence: 11, resolveAtSequence: 16, resolveOn: "team" as const },
  { id: "pred_h1_topscorer", question: "Top scorer in the first half?", options: ["player_ingles", "player_fournier", "player_mills"],
    openAtSequence: 17, lockAtSequence: 24, resolveAtSequence: 31, resolveOn: "player" as const },
  { id: "pred_bronze", question: "Who wins the bronze medal?", options: ["team_fra", "team_aus"],
    openAtSequence: 32, lockAtSequence: 60, resolveAtSequence: 72, resolveOn: "team" as const },
];
type Phase = "hidden" | "open" | "locked" | "resolved";
const lifecycle = (p: typeof PREDICTIONS[number], seq: number): Phase =>
  seq < p.openAtSequence ? "hidden" : seq < p.lockAtSequence ? "open" : seq < p.resolveAtSequence ? "locked" : "resolved";

type Result = { winners: string[]; correct: boolean; hadPick: boolean };

export default function Home() {
  const [seq, setSeq] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [paused, setPaused] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [offset, setOffset] = useState(0); // calage d'horloge : serverNow − clientNow
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [botPicks, setBotPicks] = useState<Record<string, Record<string, string>>>({});
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const last = SEED_EVENTS[SEED_EVENTS.length - 1].sequence;

  // 1) On récupère l'anchor partagé UNE fois → calage d'horloge (offset). Échec = replay local.
  useEffect(() => {
    if (!STATE_URL) return;
    let alive = true;
    fetch(STATE_URL)
      .then((r) => r.json())
      .then((a: Anchor) => { if (alive && a?.baseStartedAt) { setOffset(a.serverNow - Date.now()); setAnchor(a); } })
      .catch(() => {/* on garde le fallback local */});
    return () => { alive = false; };
  }, []);

  // 2a) Battement DÉRIVÉ (Modèle B) : actif dès que l'anchor est là. Tout vient du temps partagé.
  useEffect(() => {
    if (!anchor) return;
    const playMs = anchor.lastSequence * anchor.tickMs;
    const cycleMs = playMs + anchor.pauseMs;
    const tick = () => {
      const total = Date.now() + offset - anchor.baseStartedAt;
      const within = ((total % cycleMs) + cycleMs) % cycleMs; // modulo sûr même si offset négatif
      setSeq(within < playMs ? Math.min(Math.floor(within / anchor.tickMs) + 1, anchor.lastSequence) : anchor.lastSequence);
      setPaused(within >= playMs);
      setCycle(Math.floor(total / cycleMs) + 1);
    };
    tick();
    const id = setInterval(tick, 200); // ne POSSÈDE pas l'état : il repeint depuis l'horloge
    return () => clearInterval(id);
  }, [anchor, offset]);

  // 2b) Fallback : replay local (l'ancien battement), actif TANT QUE l'anchor n'est pas chargé.
  useEffect(() => {
    if (anchor) return;
    if (paused) {
      const t = setTimeout(() => { setSeq(0); setCycle((c) => c + 1); setPaused(false); }, PAUSE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { if (seq >= last) setPaused(true); else setSeq(seq + 1); }, TICK_MS);
    return () => clearTimeout(t);
  }, [anchor, seq, paused, last]);

  // reset à chaque nouvelle manche (`done` est gardé par cycle, pas besoin de le vider)
  useEffect(() => { setPicks({}); setResults({}); setBotPicks({}); }, [cycle]);

  // lock des bots + résolution, sur toutes les prédictions, une fois chacune par manche
  useEffect(() => {
    for (const p of PREDICTIONS) {
      const ph = lifecycle(p, seq);
      const lockKey = `${cycle}:lock:${p.id}`;
      if ((ph === "locked" || ph === "resolved") && !done[lockKey]) {
        const atLock = deriveState(SEED_EVENTS, p.lockAtSequence);
        const tally: Record<string, number> = p.resolveOn === "player" ? atLock.pointsByPlayer : atLock.scoreByTeam;
        const ranked = [...p.options].sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0));
        const fav = ranked[0], und = ranked[ranked.length - 1];
        const noInfo = (tally[fav] ?? 0) === (tally[und] ?? 0); // rien à se mettre sous la dent → hasard
        const bp: Record<string, string> = {};
        for (const b of BOTS) bp[b.id] = noInfo ? p.options[Math.floor(Math.random() * p.options.length)]
                                               : (Math.random() < b.skill ? fav : und);
        setBotPicks((prev) => ({ ...prev, [p.id]: bp }));
        setDone((prev) => ({ ...prev, [lockKey]: true }));
      }
      const resKey = `${cycle}:res:${p.id}`;
      if (ph === "resolved" && !done[resKey]) {
        const winners = resolve(p, deriveState(SEED_EVENTS, p.resolveAtSequence));
        const mine = picks[p.id] ?? null;
        const correct = mine != null && winners.includes(mine);
        setResults((prev) => ({ ...prev, [p.id]: { winners, correct, hadPick: mine != null } }));
        if (correct) setPoints((pt) => pt + WIN_POINTS);
        setDone((prev) => ({ ...prev, [resKey]: true }));
      }
    }
  }, [seq, cycle]);

  const view = deriveState(SEED_EVENTS, seq);
  const score = { team_fra: view.scoreByTeam.team_fra ?? 0, team_aus: view.scoreByTeam.team_aus ?? 0 };
  const lead = score.team_fra - score.team_aus;
  const mag = Math.min(Math.abs(lead) / 15, 1);
  const leader = lead > 0 ? TEAMS[0] : lead < 0 ? TEAMS[1] : null;
  const justScored = (() => { const e = SEED_EVENTS.find((ev) => ev.sequence === seq); return e && PTS[e.type] ? e.teamId : null; })();
  const feed = SEED_EVENTS.filter((e) => e.sequence <= seq && PTS[e.type]).reverse();
  const onAir = !paused && view.status === "playing";

  // prédiction active : en cours (open/locked) ; sinon la dernière résolue ; sinon rien
  const inFlight = PREDICTIONS.find((p) => { const ph = lifecycle(p, seq); return ph === "open" || ph === "locked"; });
  const lastResolved = [...PREDICTIONS].reverse().find((p) => lifecycle(p, seq) === "resolved");
  const active = inFlight ?? lastResolved ?? null;
  const phase: Phase = active ? lifecycle(active, seq) : "hidden";
  const aPick = active ? picks[active.id] ?? null : null;
  const aRes = active ? results[active.id] ?? null : null;
  const aBots = active ? botPicks[active.id] ?? {} : {};
  const aIndex = active ? PREDICTIONS.indexOf(active) + 1 : 0;
  const secsToLock = active ? Math.max(0, Math.ceil((active.lockAtSequence - seq) * TICK_MS / 1000)) : 0;
  const lockFraction = active ? Math.max(0, Math.min(1, (active.lockAtSequence - seq) / (active.lockAtSequence - active.openAtSequence))) : 0;

  // classement DE LA MANCHE : points cumulés sur toutes les prédictions résolues ce cycle
  const loopPts = (pickFor: (pid: string) => string | null) => PREDICTIONS.reduce((sum, p) => {
    const ws = results[p.id]?.winners ?? null; if (ws == null) return sum;
    const ch = pickFor(p.id); return sum + (ch != null && ws.includes(ch) ? WIN_POINTS : 0);
  }, 0);
  let standings = [
    { id: "you", name: "You", you: true, pts: loopPts((pid) => picks[pid] ?? null), apick: aPick },
    ...BOTS.map((b) => ({ id: b.id, name: b.name, you: false,
      pts: loopPts((pid) => botPicks[pid]?.[b.id] ?? null), apick: aBots[b.id] ?? null })),
  ].sort((a, b) => b.pts - a.pts || (a.you ? -1 : b.you ? 1 : 0));

  return (
    <main style={{ background: `radial-gradient(130% 90% at 50% -15%, #18263b 0%, transparent 55%), ${C.bg}`,
                   minHeight: "100vh", color: C.ink, fontFamily: "'Archivo', system-ui, sans-serif",
                   padding: "28px 18px", display: "flex", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes rallyPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.78)} }
        @keyframes rallyFlash { 0%{opacity:.9} 100%{opacity:0} }
        .mono { font-family:'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        @media (prefers-reduced-motion: reduce){ *{animation:none !important; transition:none !important} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 760, paddingBottom: 190 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: "0.34em", paddingLeft: 2 }}>RALLY</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: onAir ? C.live : C.muted, animation: onAir ? "rallyPulse 1.4s ease-in-out infinite" : "none" }} />
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: onAir ? C.live : C.muted }}>{paused ? "BREAK" : "LIVE"}</span>
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: C.win, border: `1px solid ${C.line}`, borderRadius: 99, padding: "3px 11px" }}>{points} PTS</span>
            <span className="mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.14em", textAlign: "right", lineHeight: 1.5 }}>
              REPLAY · 2019 FIBA WORLD CUP<br /><span style={{ opacity: 0.7 }}>FRANCE–AUSTRALIA · LOOP #{cycle}{anchor ? " · SERVER-SYNCED" : ""}</span>
            </span>
          </div>
        </header>

        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px 30px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}>
            {TEAMS.map((t, i) => {
              const lit = justScored === t.id, isLeading = leader?.id === t.id;
              return [
                i === 1 && (
                  <div key="clock" style={{ textAlign: "center", minWidth: 92 }}>
                    <div className="mono" style={{ fontSize: 13, color: C.muted, letterSpacing: "0.18em" }}>Q{view.period || 1}</div>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 600, marginTop: 2 }}>{view.gameClock}</div>
                  </div>
                ),
                <div key={t.id} style={{ textAlign: i === 0 ? "left" : "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color, boxShadow: isLeading ? `0 0 14px ${t.color}` : "none" }} />
                    <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", color: isLeading ? C.ink : C.muted }}>{t.name}</span>
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ display: "block", position: "relative", zIndex: 1, fontWeight: 800, fontSize: 76, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: isLeading ? C.ink : "#cfd4dc", marginTop: 6 }}>{score[t.id as "team_fra" | "team_aus"]}</span>
                    {lit && <span style={{ position: "absolute", inset: -6, borderRadius: 12, background: t.color, animation: "rallyFlash .7s ease-out forwards", pointerEvents: "none", zIndex: 0 }} />}
                  </div>
                </div>,
              ];
            })}
          </div>
          <div style={{ marginTop: 26 }}>
            <div style={{ position: "relative", height: 12, borderRadius: 99, background: "#0c1119", border: `1px solid ${C.line}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.line, transform: "translateX(-0.5px)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: lead >= 0 ? `${50 - mag * 50}%` : "50%", width: `${mag * 50}%`,
                            background: lead >= 0 ? C.fra : C.aus, transition: "left .6s cubic-bezier(.4,0,.2,1), width .6s cubic-bezier(.4,0,.2,1), background .3s" }} />
            </div>
            <div className="mono" style={{ marginTop: 9, fontSize: 11, letterSpacing: "0.16em", color: C.muted, textAlign: "center" }}>
              {lead === 0 ? "TIED — ANYONE'S GAME" : `${leader!.name.toUpperCase()} LEAD · +${Math.abs(lead)}`}
            </div>
          </div>
        </section>

        {/* standings — toi vs bots CPU, cumulé sur la manche */}
        <section style={{ marginTop: 22 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: C.muted, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
            <span>STANDINGS · THIS LOOP</span><span style={{ opacity: 0.7 }}>🤖 = CPU</span>
          </div>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            {standings.map((e, idx) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                                       background: e.you ? "#141d2b" : "transparent", borderTop: idx === 0 ? "none" : `1px solid ${C.line}` }}>
                <span className="mono" style={{ width: 14, fontSize: 12, color: C.muted }}>{idx + 1}</span>
                <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{e.you ? "🧑" : "🤖"}</span>
                <span style={{ flex: 1, fontWeight: e.you ? 700 : 600, fontSize: 14, color: e.you ? C.ink : "#c3c9d4" }}>{e.you ? "You" : `CPU · ${e.name}`}</span>
                {e.apick
                  ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: dotColorOf(e.apick) }} />
                      <span className="mono" style={{ fontSize: 11, color: C.muted }}>{shortOf(e.apick)}</span>
                    </span>
                  : <span className="mono" style={{ fontSize: 11, color: C.muted, opacity: 0.5 }}>…</span>}
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, minWidth: 30, textAlign: "right", color: e.pts > 0 ? C.win : C.muted }}>{e.pts}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: C.muted, marginBottom: 10 }}>PLAY-BY-PLAY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {feed.length === 0 && <div style={{ color: C.muted, fontSize: 14, padding: "10px 0" }}>Waiting for tip-off…</div>}
            {feed.map((e) => {
              const t = TEAMS.find((x) => x.id === e.teamId);
              return (
                <div key={e.sequence} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 12px", borderRadius: 9, background: e.sequence === seq ? "#141b25" : "transparent", transition: "background .4s" }}>
                  <span className="mono" style={{ fontSize: 12, color: C.muted, width: 44 }}>{e.gameClock}</span>
                  <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: t?.color ?? C.line }} />
                  <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{e.descriptionEn ?? e.descriptionFr ?? ""}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: t?.color }}>+{PTS[e.type]}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* prediction card : file d'attente, une carte à la fois, glisse du bas */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", zIndex: 50,
                    padding: "0 18px 18px", pointerEvents: "none",
                    transform: active && phase !== "hidden" ? "translateY(0)" : "translateY(160%)",
                    transition: "transform .5s cubic-bezier(.4,0,.2,1)" }}>
        <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 760, background: "#0e141d", border: `1px solid ${C.line}`,
                      borderRadius: 16, padding: "18px 20px", boxShadow: "0 -24px 60px rgba(0,0,0,.55)" }}>
          <div style={{ height: 3, borderRadius: 99, background: "#1a2330", overflow: "hidden", marginBottom: 14 }}>
            {phase === "open" && <div style={{ height: "100%", width: `${lockFraction * 100}%`, background: C.live, transition: `width ${TICK_MS}ms linear` }} />}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: phase === "resolved" ? (aRes?.correct ? C.win : C.live) : phase === "locked" ? C.muted : C.live }}>
                {phase === "resolved" ? "RESULT" : "PREDICTION"}
              </span>
              <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: C.muted, opacity: 0.7 }}>{aIndex}/{PREDICTIONS.length}</span>
            </span>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: phase === "open" ? C.live : C.muted }}>
              {phase === "open" ? `LOCKS IN 0:${String(secsToLock).padStart(2, "0")}` : phase === "locked" ? "PICKS CLOSED" : "FINAL"}
            </span>
          </div>

          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{active?.question}</div>

          <div style={{ display: "flex", gap: 10 }}>
            {active?.options.map((opt) => {
              const isPick = aPick === opt;
              const isWinner = aRes?.winners?.includes(opt) ?? false;
              let border = C.line, bg = "transparent", col = C.muted, tag: string | null = null;
              if (phase === "open") { if (isPick) { border = dotColorOf(opt); bg = dotColorOf(opt) + "22"; col = C.ink; } }
              else if (phase === "locked") { if (isPick) { border = dotColorOf(opt); bg = dotColorOf(opt) + "14"; col = C.ink; tag = "YOUR PICK"; } }
              else { if (isWinner) { border = C.win; col = C.ink; tag = "WINNER"; } else if (isPick) { border = C.live; col = C.muted; }
                     if (isPick && !isWinner) tag = "YOUR PICK"; if (isPick && isWinner) tag = "YOUR PICK ✓"; }
              return (
                <button key={opt} onClick={() => phase === "open" && active && setPicks((prev) => ({ ...prev, [active.id]: opt }))} disabled={phase !== "open"}
                  style={{ flex: 1, padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${border}`, background: bg, color: col,
                           fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: phase === "open" ? "pointer" : "default",
                           transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: dotColorOf(opt) }} />{labelOf(opt)}
                    {phase === "open" && isPick && " ✓"}
                  </span>
                  {tag && <span className="mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: isWinner ? C.win : C.muted }}>{tag}</span>}
                </button>
              );
            })}
          </div>

          <div className="mono" style={{ marginTop: 12, fontSize: 11.5, letterSpacing: "0.04em", color: C.muted, textAlign: "center" }}>
            {phase === "open" && (aPick ? "You can still change until picks close" : "Tap an option — picks close soon")}
            {phase === "locked" && (aPick ? <span>Locked: {labelOf(aPick)} — waiting for the result…</span> : "Picks closed — no pick this round")}
            {phase === "resolved" && (aRes?.correct ? <span style={{ color: C.win }}>Nailed it · +{WIN_POINTS} pts</span>
              : aRes?.hadPick ? <span>Missed — {(aRes?.winners ?? []).map(labelOf).join(" & ")}</span>
              : <span>No pick — {(aRes?.winners ?? []).map(labelOf).join(" & ")}</span>)}
          </div>
        </div>
      </div>
    </main>
  );
}