"use client";
// useRallyRoom — LE cerveau socket, partagé. Une seule connexion WebSocket pour tout :
// la présence (roster, join, name_taken, reconnexion) ET le relay des picks.
// Presence.tsx devient un composant d'affichage bête ; page.tsx consomme les picks.
//
// Rappels des patterns (posés en A2) :
// - refs-in-callbacks : onmessage/onclose capturent le render initial (closure) → tout ce
//   qu'ils lisent AU FIL DU TEMPS vit dans un ref ; ce qui repeint l'écran vit dans un state.
// - « suis-je dedans ? » : inféré du roster (s'il contient mon pseudo → joined).
// - reconnexion : backoff exponentiel (2s→15s) + re-claim auto du pseudo.
import { useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_RALLY_WS_URL;

export type RoomStatus = "off" | "connecting" | "connected" | "joining" | "joined" | "taken";

export default function useRallyRoom(opts: {
  cycle: number;                                   // manche courante : tague les picks sortants, filtre les entrants
  canAcceptPick: (predictionId: string) => boolean; // règle du lock, vérifiée CLIENT en V1 (Lambda en V2)
}) {
  const [status, setStatus] = useState<RoomStatus>(WS_URL ? "connecting" : "off");
  const [roster, setRoster] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [me, setMe] = useState<string | null>(null);
  // pseudo → { predictionId → choice } — UNIQUEMENT la manche courante (vidé au changement)
  const [remotePicks, setRemotePicks] = useState<Record<string, Record<string, string>>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const meRef = useRef<string | null>(null);
  const retryRef = useRef(0);
  const byUsRef = useRef(false);
  // « latest value » : les callbacks du socket lisent TOUJOURS la valeur courante via ces refs
  const cycleRef = useRef(opts.cycle);
  cycleRef.current = opts.cycle;
  const acceptRef = useRef(opts.canAcceptPick);
  acceptRef.current = opts.canAcceptPick;

  // nouvelle manche → les picks de l'ancienne ne comptent plus
  useEffect(() => { setRemotePicks({}); }, [opts.cycle]);

  useEffect(() => {
    if (!WS_URL) return;
    byUsRef.current = false;

    function connect() {
      const ws = new WebSocket(WS_URL as string);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        if (meRef.current) { setStatus("joining"); ws.send(JSON.stringify({ action: "join", name: meRef.current })); }
        else setStatus("connected");
      };

      ws.onmessage = (ev) => {
        let msg: { type?: string; players?: string[]; name?: string; predictionId?: string; choice?: string; cycleIndex?: number };
        try { msg = JSON.parse(ev.data); } catch { return; }

        if (msg.type === "roster") {
          setRoster(msg.players ?? []);
          if (meRef.current && msg.players?.includes(meRef.current)) setStatus("joined");
        } else if (msg.type === "name_taken") {
          meRef.current = null; setMe(null); setStatus("taken");
        } else if (msg.type === "pick") {
          // Filtres à la RÉCEPTION (V1, côté client) :
          if (msg.cycleIndex !== cycleRef.current) return;            // pick d'une autre manche → ignoré
          if (!msg.name || !msg.predictionId || !msg.choice) return;
          if (!acceptRef.current(msg.predictionId)) return;           // arrivé après le lock → ignoré
          const { name: n, predictionId: pid, choice } = msg;
          setRemotePicks((prev) => ({ ...prev, [n]: { ...prev[n], [pid]: choice } }));
        }
      };

      ws.onerror = () => { try { ws.close(); } catch {} };

      ws.onclose = () => {
        if (byUsRef.current) return;
        setStatus("connecting");
        const delay = Math.min(2000 * 2 ** retryRef.current++, 15000);
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

  // Envoie MON pick au relay. Le serveur y attache mon pseudo (lu en table) et le
  // rediffuse à tous — y compris moi (écho idempotent, sans effet : même clé, même valeur).
  function sendPick(predictionId: string, choice: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return; // pas de socket → jeu solo, pick local seulement
    ws.send(JSON.stringify({ action: "pick", predictionId, choice, cycleIndex: cycleRef.current }));
  }

  return { status, roster, name, setName, me, join, remotePicks, sendPick };
}