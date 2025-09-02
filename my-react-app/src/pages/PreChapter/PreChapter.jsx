import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth } from "../../services/firebaseConfig";
import { getCurrentChapter } from "../../services/chapterService";
import { getChapterHandler } from "../Game/chapters/index.js";

// 👇 importa estilos de la página
import "./prechapter.css";

const PreChapterScreen = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const db = getFirestore();

  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hoarder, setHoarder] = useState(null);
  const [readyCount, setReadyCount] = useState({ ready: 0, total: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getCurrentChapter(roomId);
        if (!alive) return;

        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const loadedPlayers = roomSnap.data()?.players || [];

        const handler = getChapterHandler(data);
        const ctx =
          (await handler.prepare?.({ roomId, players: loadedPlayers, chapter: data })) || {};

        if (!alive) return;
        setChapter(data);
        setPlayers(loadedPlayers);
        setHoarder(ctx.hoarder ?? null);

        if (roomSnap.data()?.state !== "PRE") {
          await updateDoc(roomRef, { state: "PRE" });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, roomId]);

  useEffect(() => {
    const roomRef = doc(db, "rooms", roomId);
    const unsub = onSnapshot(roomRef, (snap) => {
      const data = snap.data() || {};
      const total = (data.players || []).length;
      const ready = (data.players || []).filter((p) => p.readyForChapter).length;
      setReadyCount({ ready, total });

      if (data.state === "PLAY") {
        navigate(`/game/${roomId}`);
      }
    });
    return () => unsub();
  }, [db, roomId, navigate]);

  if (loading || !chapter) return <div className="page-loading">Cargando capítulo…</div>;

  const handler = getChapterHandler(chapter);
  const pre = handler.getPreContent?.({ chapter, hoarder }) || {
    title: chapter.title,
    message:
      'Antes de oprimir "Listo", leer la carta del capítulo correspondiente y asegurarse de que todos entiendan.'
  };

  const handleReady = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const data = roomSnap.data();
    const updatedPlayers = (data.players || []).map((p) =>
      p.uid === user.uid ? { ...p, readyForChapter: true } : p
    );
    await updateDoc(roomRef, { players: updatedPlayers });

    const allReady = updatedPlayers.every((p) => p.readyForChapter);
    if (allReady) {
      const resetPlayers = updatedPlayers.map((p) => ({ ...p, readyForChapter: false }));
      await updateDoc(roomRef, { players: resetPlayers, state: "PLAY" });
      navigate(`/game/${roomId}`);
    }
  };

  return (
    <div className="pre">
      <h2 className="pre__title">{pre.title}</h2>
      {pre.highlight && <p className="pre__highlight">{pre.highlight}</p>}
      <p className="pre__message">{pre.message}</p>

      <div className="pre__ready">
        Listos: {readyCount.ready}/{readyCount.total}
      </div>

      <button onClick={handleReady} className="btn btn--gold">
        Listo
      </button>
    </div>
  );
};

export default PreChapterScreen;
