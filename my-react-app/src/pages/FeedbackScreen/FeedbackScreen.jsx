// src/pages/Feedback/FeedbackScreen.jsx
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../../services/firebaseConfig";

import FeedbackMessage from "../../components/Feedback/FeedbackMessage";
import FeedbackAnnouncements from "../../components/Feedback/FeedbackAnnouncements";
import FeedbackList from "../../components/Feedback/FeedbackList";
import ContinueButton from "../../components/Feedback/ContinueButton";

function FeedbackScreen() {
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

  const handleNavigate = (next) => {
    if (next === "GAME_OVER_SELF") {
      return navigate("/game-over", { state: { reason: "eliminated" } });
    }
    if (next === "LOBBY") return navigate("/lobby");
    if (typeof next === "string") return navigate(`/game/${roomId}`);
  };

  if (!res) {
    return (
      <div className="feedback-page center">
        <div className="card">
          <p className="muted">Resolviendo…</p>
        </div>
      </div>
    );
  }

  const myUid = auth.currentUser?.uid;
  const eliminatedSelf = !!res.eliminated?.some((p) => p.uid === myUid);

  return (
    <div className="feedback-page center">
      <div className="card">
        <h2 className="title">Resolución</h2>

        <FeedbackMessage text={res.feedback} />
        <FeedbackAnnouncements items={res.announcements || []} />
        <FeedbackList label="Salvados"   people={res.saved || []} />
        <FeedbackList label="Eliminados" people={res.eliminated || []} />

        <ContinueButton
          roomId={roomId}
          gameOver={!!res.gameOver}
          eliminatedSelf={eliminatedSelf}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}

export default FeedbackScreen;
