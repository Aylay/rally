"use client";

import { useState, useEffect } from "react";
import { SEED_EVENTS, deriveState, resolve } from "@rally/engine";

// Points par type — AFFICHAGE uniquement (badge +2/+3). La vérité du score
// vit dans le moteur ; ceci ne sert qu'au feed.
const PTS: Record<string, number> = { shot_2pts: 2, shot_3pts: 3, free_throw: 1 };

const TICK_MS = 1500, PAUSE_MS = 5000, WIN_POINTS = 10;
const C = { bg: "#0a0d12", panel: "#10151d", line: "#202a38", ink: "#f1efe9", muted: "#828c9c",
            fra: "#3b74ff", aus: "#f5c518", live: "#ff5640", win: "#34e29a" };
const TEAMS = [
  { id: "team_fra", name: "France", abbr: "FRA", color: C.fra },
  { id: "team_aus", name: "Australia", abbr: "AUS", color: C.aus },
];
const nameOf = (id: string) => TEAMS.find((t) => t.id === id)?.name ?? id;
const colorOf = (id: string) => TEAMS.find((t) => t.id === id)?.color ?? C.line;

// openAtSequence = quand la carte apparaît. C'est un ajout naturel au modèle
// Prediction du moteur ; resolve() n'en a pas besoin, on le garde côté UI pour V1.
const PRED = {
  id: "pred_q1_leader", question: "Who leads at the end of Q1?",
  options: ["team_fra", "team_aus"], openAtSequence: 2, lockAtSequence: 6, resolveAtSequence: 9, resolveOn: "team" as const,
};

type Result = { winner: string; correct: boolean; hadPick: boolean };

export default function Home() {
  const [seq, setSeq] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [paused, setPaused] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [points, setPoints] = useState(0);
  const [scoredCycle, setScoredCycle] = useState(0);
  const last = SEED_EVENTS[SEED_EVENTS.length - 1].sequence;

  // Le "battement" local : en attendant AWS, le navigateur fait avancer le match.
  // Plus tard, on remplace ce timer par le flux WebSocket — la logique ne bouge pas.
  useEffect(() => {
    if (paused) {
      const t = setTimeout(() => { setSeq(0); setCycle((c) => c + 1); setPaused(false); }, PAUSE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { if (seq >= last) setPaused(true); else setSeq(seq + 1); }, TICK_MS);
    return () => clearTimeout(t);
  }, [seq, paused, last]);

  // reset du prono à chaque nouvelle manche
  useEffect(() => { setPick(null); setResult(null); }, [cycle]);

  const phase =
    seq < PRED.openAtSequence ? "hidden" :
    seq < PRED.lockAtSequence ? "open" :
    seq < PRED.resolveAtSequence ? "locked" : "resolved";
  // compte à rebours jusqu'au lock — ancré sur la séquence (= l'horloge partagée)
  const secsToLock = Math.max(0, Math.ceil((PRED.lockAtSequence - seq) * TICK_MS / 1000));
  const lockFraction = Math.max(0, Math.min(1, (PRED.lockAtSequence - seq) / (PRED.lockAtSequence - PRED.openAtSequence)));

  // résolution (une fois par manche) — la bonne réponse n'est jamais stockée,
  // elle est DÉRIVÉE de l'état à resolveAtSequence.
  useEffect(() => {
    if (phase === "resolved" && scoredCycle !== cycle) {
      const winner = resolve(PRED, deriveState(SEED_EVENTS, PRED.resolveAtSequence));
      const correct = pick != null && pick === winner;
      setResult({ winner, correct, hadPick: pick != null });
      if (correct) setPoints((p) => p + WIN_POINTS);
      setScoredCycle(cycle);
    }
  }, [phase, cycle, scoredCycle, pick]);

  const view = deriveState(SEED_EVENTS, seq);
  const score = { team_fra: view.scoreByTeam.team_fra ?? 0, team_aus: view.scoreByTeam.team_aus ?? 0 };
  const lead = score.team_fra - score.team_aus;
  const mag = Math.min(Math.abs(lead) / 10, 1);
  const leader = lead > 0 ? TEAMS[0] : lead < 0 ? TEAMS[1] : null;
  const justScored = (() => { const e = SEED_EVENTS.find((ev) => ev.sequence === seq); return e && PTS[e.type] ? e.teamId : null; })();
  const feed = SEED_EVENTS.filter((e) => e.sequence <= seq && PTS[e.type]).reverse();
  const onAir = !paused && view.status === "playing";

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

      <div style={{ width: "100%", maxWidth: 760, paddingBottom: 180 }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: "0.34em", paddingLeft: 2 }}>RALLY</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: onAir ? C.live : C.muted, animation: onAir ? "rallyPulse 1.4s ease-in-out infinite" : "none" }} />
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: onAir ? C.live : C.muted }}>{paused ? "BREAK" : "LIVE"}</span>
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: C.win,
                                            border: `1px solid ${C.line}`, borderRadius: 99, padding: "3px 11px" }}>
              {points} PTS
            </span>
            <span className="mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.14em", textAlign: "right", lineHeight: 1.5 }}>
              REPLAY · 2019 FIBA WORLD CUP<br /><span style={{ opacity: 0.7 }}>FRANCE–AUSTRALIA · LOOP #{cycle}</span>
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
                    <span style={{ display: "block", fontWeight: 800, fontSize: 76, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: isLeading ? C.ink : "#cfd4dc", marginTop: 6 }}>{score[t.id as "team_fra" | "team_aus"]}</span>
                    {lit && <span style={{ position: "absolute", inset: -6, borderRadius: 12, background: t.color, animation: "rallyFlash .7s ease-out", pointerEvents: "none" }} />}
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

      {/* prediction card : glisse depuis le bas, le match reste visible */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center",
                    padding: "0 18px 18px", pointerEvents: "none",
                    transform: phase !== "hidden" ? "translateY(0)" : "translateY(150%)",
                    transition: "transform .5s cubic-bezier(.4,0,.2,1)" }}>
        <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 760, background: "#0e141d",
                      border: `1px solid ${C.line}`, borderRadius: 16, padding: "18px 20px",
                      boxShadow: "0 -24px 60px rgba(0,0,0,.55)" }}>
          {/* barre de compte à rebours : se vide pendant la fenêtre de vote */}
          <div style={{ height: 3, borderRadius: 99, background: "#1a2330", overflow: "hidden", marginBottom: 14 }}>
            {phase === "open" && (
              <div style={{ height: "100%", width: `${lockFraction * 100}%`, background: C.live,
                            transition: `width ${TICK_MS}ms linear` }} />
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em",
                                            color: phase === "resolved" ? (result?.correct ? C.win : C.live) : phase === "locked" ? C.muted : C.live }}>
              {phase === "resolved" ? "RESULT" : "PREDICTION"}
            </span>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.14em",
                                            color: phase === "open" ? C.live : C.muted }}>
              {phase === "open" ? `LOCKS IN 0:${String(secsToLock).padStart(2, "0")}`
                : phase === "locked" ? "PICKS CLOSED"
                : "Q1 · FINAL"}
            </span>
          </div>

          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{PRED.question}</div>

          <div style={{ display: "flex", gap: 10 }}>
            {PRED.options.map((opt) => {
              const isPick = pick === opt;
              const isWinner = result?.winner === opt;
              let border = C.line, bg = "transparent", col = C.muted, tag: string | null = null;
              if (phase === "open") {
                if (isPick) { border = colorOf(opt); bg = colorOf(opt) + "22"; col = C.ink; }
              } else if (phase === "locked") {
                if (isPick) { border = colorOf(opt); bg = colorOf(opt) + "14"; col = C.ink; tag = "YOUR PICK"; }
              } else {
                if (isWinner) { border = C.win; col = C.ink; tag = "WINNER"; }
                else if (isPick) { border = C.live; col = C.muted; }
                if (isPick && !isWinner) tag = "YOUR PICK";
                if (isPick && isWinner) tag = "YOUR PICK ✓";
              }
              return (
                <button key={opt} onClick={() => phase === "open" && setPick(opt)} disabled={phase !== "open"}
                  style={{ flex: 1, padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${border}`, background: bg,
                           color: col, fontFamily: "inherit", fontWeight: 700, fontSize: 15,
                           cursor: phase === "open" ? "pointer" : "default", transition: "all .2s",
                           display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: colorOf(opt) }} />{nameOf(opt)}
                    {phase === "open" && isPick && " ✓"}
                  </span>
                  {tag && <span className="mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: isWinner ? C.win : C.muted }}>{tag}</span>}
                </button>
              );
            })}
          </div>

          <div className="mono" style={{ marginTop: 12, fontSize: 11.5, letterSpacing: "0.04em", color: C.muted, textAlign: "center" }}>
            {phase === "open" && (pick ? "You can still change until picks close" : "Tap a team — picks close soon")}
            {phase === "locked" && (pick ? <span>Locked: {nameOf(pick)} — waiting for end of Q1…</span> : "Picks closed — no pick this round")}
            {phase === "resolved" && (result?.correct ? <span style={{ color: C.win }}>Nailed it · +{WIN_POINTS} pts</span>
              : result?.hadPick ? <span>Missed — {nameOf(result.winner)} led</span>
              : <span>No pick this round — {nameOf(result?.winner ?? "")} led</span>)}
          </div>
        </div>
      </div>
    </main>
  );
}