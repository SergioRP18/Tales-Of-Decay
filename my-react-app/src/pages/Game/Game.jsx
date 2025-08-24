import React, { useState } from "react";
import TimerInput from "../../components/TimerInput/TimerInput";
import { useNavigate } from "react-router-dom";

const GameScreen = () => {
  const [isAnswerPhase, setIsAnswerPhase] = useState(false);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const navigate = useNavigate();

  // Cuando terminan los 30s de discusión
  const handleDiscussionEnd = () => {
    setIsAnswerPhase(true);
    setOptionsEnabled(true);
  };

  // Cuando terminan los 15s de respuesta
  const handleAnswerEnd = () => {
    setOptionsEnabled(false);
    if (!selectedOption) {
      navigate("/game-over", { state: { reason: "no-selection" } });
    } else {
      // Validar respuesta y continuar el juego...
      // Si es incorrecta:
      // navigate("/game-over", { state: { reason: "wrong-answer" } });
    }
  };

  return (
    <div>
      <TimerInput
        isAnswerPhase={isAnswerPhase}
        onDiscussionEnd={handleDiscussionEnd}
        onAnswerEnd={handleAnswerEnd}
      />
      {/* Opciones de respuesta solo en fase de respuesta */}
      {isAnswerPhase && (
        <div>
          <button
            disabled={!optionsEnabled}
            onClick={() => setSelectedOption("A")}
          >
            Opción A
          </button>
          <button
            disabled={!optionsEnabled}
            onClick={() => setSelectedOption("B")}
          >
            Opción B
          </button>
          {/* ...más opciones */}
        </div>
      )}
    </div>
  );
};

export default GameScreen;