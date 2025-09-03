// src/components/Feedback/ContinueButton.jsx
import React, { useState } from "react";
import { applyResolution } from "../../services/feedbackService";

export default function ContinueButton({
  roomId,
  gameOver = false,        // opcional, lo decide el service leyendo lastResolution
  eliminatedSelf = false,
  onNavigate,              // (next) => void  |  next ∈ {"GAME_OVER_SELF","LOBBY","NEXT"}
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await applyResolution(roomId, { eliminatedSelf });
      if (onNavigate) onNavigate(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn-option" disabled={busy} onClick={handleClick}>
      {busy ? "Procesando…" : gameOver ? "Volver" : "Continuar"}
    </button>
  );
}
