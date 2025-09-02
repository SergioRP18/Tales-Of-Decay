// src/pages/PreChapter/PreChapter.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "../../services/firebaseConfig";
import { getCurrentChapter } from "../../services/chapterService";
import { setReady, getReadies, clearReadies } from "../../services/readyService";
import { mirrorBotsReady } from "../../services/debugService";
import { seedBots, removeBots } from "../../services/roomService";
import "./prechapter.css";

export default function PreChapter() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [chapter, setChapter] = useState(null);

  const [dbg, setDbg] = useState({
    show: import.meta.env.DEV,
    mirror: localStorage.getItem("mirrorBots") === "1",
  });
  const toggleMirror = () => {
    const v = !dbg.mirror;
    localStorage.setItem("mirrorBots", v ? "1" : "0");
    setDbg((s) => ({ ...s, mirror: v }));
  };

  const db = getFirestore();
  const navigate = useNavigate();

  // Carga players + capítulo actual
  useEffect(() => {
    (async () => {
      const roomRef = doc(db, "rooms", roomId);
      const snap = await getDoc(roomRef);
      const data = snap.data() || {};
      setPlayers(Array.isArray(data.players) ? data.players : []);
      const ch = await getCurrentChapter(roomId);
      setChapter(ch);
    })();
  }, [db, roomId]);

  // Poll de “Listo” SOLO del capítulo actual y SOLO de jugadores actuales
  useEffect(() => {
    if (!roomId || !chapter?.id) return;
    let cancel = false;

    const tick = async () => {
      const list = await getReadies(roomId, chapter.id);
      // Filtra a solo jugadores actuales (por si alguien fue eliminado)
      const present = new Set(players.map((p) => p.uid));
      const count = list.filter((r) => r.ready && present.has(r.playerId)).length;
      if (!cancel) setReadyCount(count);

      // Avanza automáticamente cuando estén todos los presentes
      if (players.length > 0 && count === players.length) {
        await updateDoc(doc(db, "rooms", roomId), { state: "PLAY" });
        navigate(`/game/${roomId}`);
      }
    };

    const i = setInterval(tick, 800);
    tick();
    return () => { cancel = true; clearInterval(i); };
  }, [db, roomId, players, chapter, navigate]);

  async function onReadyClick() {
    if (!chapter?.id) return;
    await setReady(roomId, chapter.id, auth.currentUser.uid, true);
    if (dbg.mirror) await mirrorBotsReady(roomId, players, chapter.id);
  }

  async function skipChapterDbg() {
    if (!chapter?.id) return;
    await clearReadies(roomId, chapter.id);

    const survivors = players.map((p) => ({ uid: p.uid, name: p.username }));
    await setDoc(
      doc(db, "rooms", roomId, "meta", "lastResolution"),
      {
        chapterId: chapter.id,
        groupOptionId: "debug-skip",
        groupIsCorrect: true,
        feedback: "DEBUG: saltar capítulo",
        announcements: [],
        saved: [],
        eliminated: [],
        survivors,
        nextChapterId: chapter.nextChapter || null,
        gameOver: false,
        resolvedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await updateDoc(doc(db, "rooms", roomId), { state: "FEEDBACK" });
    navigate(`/feedback/${roomId}`);
  }

  return (
    <div className="prechapter">
      <h2>{chapter?.title || "Precapítulo"}</h2>
      <p>Antes de oprimir “LISTO”, lean la carta del capítulo correspondiente y asegúrense de que todos entiendan.</p>
      <p>Listos: {readyCount}/{players.length}</p>

      <button className="btn-option" onClick={onReadyClick}>LISTO</button>

      {dbg.show && (
        <div className="debug-bar" style={{ marginTop: 16, opacity: 0.85 }}>
          <button className="btn-option" onClick={() => seedBots(roomId, 7)}>+7 bots (DEV)</button>
          <button className="btn-option" onClick={toggleMirror}>
            {dbg.mirror ? "Mirror bots: ON" : "Mirror bots: OFF"}
          </button>
          <button className="btn-option" onClick={skipChapterDbg}>Siguiente capítulo (DBG)</button>
          <button className="btn-option btn-danger" onClick={() => removeBots(roomId)}>Quitar bots</button>
          <button className="btn-option btn-danger" onClick={() => chapter?.id && clearReadies(roomId, chapter.id)}>
            Limpiar “Listo” (DBG)
          </button>
        </div>
      )}
    </div>
  );
}
