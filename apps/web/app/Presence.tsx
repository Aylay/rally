"use client";
// Rally — A2 : présence live (WebSocket). Composant ISOLÉ : toute la logique WS vit ici,
// page.tsx ne fait que <Presence />. Additif pur : ne touche ni l'horloge ni le scoreboard.
//
// Cycle de vie :
//   1) on ouvre le socket au montage (connecting)
//   2) l'utilisateur choisit un pseudo → {action:"join", name}
//   3) le serveur diffuse le roster → si mon pseudo y est, je suis "joined"
//      (ou {type:"name_taken"} → on redemande)
//   4) si le socket tombe, on se reconnecte (backoff) et on re-claim le pseudo.
// Pas d'URL / socket mort → le composant se masque (fallback gracieux : le reste de l'app tourne).
import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_RALLY_WS_URL;
const C = { panel: "#0e141d", line: "#202a38", ink: "#f1efe9", muted: "#828c9c", live: "#ff5640", win: "#34e29a" };

type Status = "off" | "connecting" | "connected" | "joining" | "joined" | "taken";

export default function Presence() {
  const [status, setStatus] = useState<Status>(WS_URL ? "connecting" : "off");
  const [roster, setRoster] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [me, setMe] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const meRef = useRef<string | null>(null);   // miroir de `me` pour le re-claim après reconnexion
  const retryRef = useRef(0);                    // compteur de backoff
  const byUsRef = useRef(false);                 // fermeture volontaire (unmount) → pas de reconnexion

  useEffect(() => {
    if (!WS_URL) return;
    byUsRef.current = false;

    function connect() {
      const ws = new WebSocket(WS_URL as string);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        // Reconnexion : si on avait déjà un pseudo, on le re-réclame automatiquement.
        if (meRef.current) { setStatus("joining"); ws.send(JSON.stringify({ action: "join", name: meRef.current })); }
        else setStatus("connected");
      };

      ws.onmessage = (ev) => {
        let msg: { type?: string; players?: string[]; name?: string };
        try { msg = JSON.parse(ev.data); } catch { return; }

        if (msg.type === "roster") {
          setRoster(msg.players ?? []);
          // Mon pseudo est dans le roster → ma réservation a réussi, je suis dedans.
          if (meRef.current && msg.players?.includes(meRef.current)) setStatus("joined");
        } else if (msg.type === "name_taken") {
          meRef.current = null; setMe(null); setStatus("taken");   // on garde `name` dans l'input pour retenter
        }
      };

      ws.onerror = () => { try { ws.close(); } catch {} };

      ws.onclose = () => {
        if (byUsRef.current) return;                 // unmount volontaire : on ne reconnecte pas
        setStatus("connecting");
        const delay = Math.min(2000 * 2 ** retryRef.current++, 15000); // 2s, 4s, 8s… plafonné 15s
        window.setTimeout(connect, delay);
      };
    }

    connect();
    return () => { byUsRef.current = true; wsRef.current?.close(); };
  }, []);

  function join() {
    const n = name.trim();
    const ws = wsRef.current;
    if (!n || !ws || ws.readyState !== WebSocket.OPEN) return;
    meRef.current = n; setMe(n); setStatus("joining");
    ws.send(JSON.stringify({ action: "join", name: n }));
  }

  if (!WS_URL) return null; // fallback gracieux : rien à afficher si le WS n'est pas configuré

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