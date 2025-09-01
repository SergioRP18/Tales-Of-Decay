import { useState } from "react";
import { applyResolution } from "../../services/feedbackService";

export default function ContinueButton({ roomId, gameOver, onNavigate }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const out = await applyResolution(roomId);
      onNavigate?.(out?.next ?? null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className="feedback-continue" onClick={handleClick} disabled={loading}>
      {loading ? "Procesando..." : gameOver ? "Volver al lobby" : "Continuar"}
    </button>
  );
}
