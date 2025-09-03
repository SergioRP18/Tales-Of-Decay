// src/pages/Survivors/Survivors.jsx
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../services/firebaseConfig";
import "./survivor.css";

function Survivor() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [res, setRes] = useState(null);

  useEffect(() => {
    const ref = doc(db, "rooms", roomId, "meta", "lastResolution");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setRes(snap.data());
    });
    return () => unsub();
  }, [roomId]);

  const survivors = useMemo(() => res?.survivors || [], [res]);

  const goLobby = async () => {
    // marcar cierre y llevar sala a LOBBY
    await setDoc(
      doc(db, "rooms", roomId, "meta", "lastResolution"),
      { gameOver: true, endedAt: serverTimestamp() },
      { merge: true }
    );
    await updateDoc(doc(db, "rooms", roomId), { state: "LOBBY" });
    navigate("/lobby");
  };

  if (!res) {
    return (
      <div className="survivors-page center">
        <div className="card">
          <p className="muted">Cargando supervivientes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="survivors-page center">
      <div className="card card--dark">
        <h2 className="title">Supervivientes</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          {res.feedback || "El grupo alcanzó el final del camino."}
        </p>

        {survivors.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>Nadie sobrevivió.</p>
        ) : (
          <ol className="survivors-list">
            {survivors.map((p) => (
              <li key={p.uid} className="survivor">
                <span className="survivor__name">{p.name || p.uid}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="survivors-actions">
          <button className="btn-option" onClick={goLobby}>Salir</button>
        </div>
      </div>
    </div>
  );
}

export default Survivor;