"use client";
// Presence — AFFICHAGE seul. La logique socket vit dans useRallyRoom (le hook partagé) ;
// ce composant reçoit tout en props. Même UI qu'avant, zéro WebSocket dedans.
import type { RoomStatus } from "./useRallyRoom";

const C = { panel: "#0e141d", line: "#202a38", ink: "#f1efe9", muted: "#828c9c", live: "#ff5640", win: "#34e29a" };

type Props = {
  status: RoomStatus;
  roster: string[];
  name: string;
  setName: (n: string) => void;
  me: string | null;
  join: () => void;
};

export default function Presence({ status, roster, name, setName, me, join }: Props) {
  if (status === "off") return null; // pas de WS configuré → la section disparaît, l'app tourne

  const joined = status === "joined";
  const others = roster.filter((r) => r !== me);
  const canJoin = !!name.trim() && (status === "connected" || status === "taken");

  const wrap: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
    padding: "10px 14px", marginBottom: 18, minHeight: 22,
  };
  const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

  if (joined) {
    return (
      <div style={wrap}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, ...mono, fontSize: 12, letterSpacing: "0.1em", color: C.win }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.win }} />
          {roster.length} WATCHING
        </span>
        <span style={{ color: C.muted, fontSize: 13 }}>
          <b style={{ color: C.ink }}>{me}</b><span style={{ color: C.muted }}> (you)</span>
          {others.length > 0 && <> · {others.join(" · ")}</>}
        </span>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <span style={{ color: C.muted, fontSize: 13, ...mono, letterSpacing: "0.06em" }}>
        {status === "connecting" ? "CONNECTING…" : "JOIN THE LIVE GAME"}
      </span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && join()}
        placeholder="your name"
        maxLength={20}
        disabled={status === "connecting" || status === "joining"}
        style={{ background: "#0a0d12", border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink,
                 padding: "6px 10px", fontSize: 13, outline: "none", width: 140 }}
      />
      <button
        onClick={join}
        disabled={!canJoin}
        style={{ background: canJoin ? C.ink : "#1b222c", color: canJoin ? "#0a0d12" : C.muted,
                 border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700,
                 cursor: canJoin ? "pointer" : "default" }}
      >
        {status === "joining" ? "Joining…" : "Join"}
      </button>
      {status === "taken" && (
        <span style={{ color: C.live, fontSize: 12 }}>that name is taken — try another.</span>
      )}
    </div>
  );
}