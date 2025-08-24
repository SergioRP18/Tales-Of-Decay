import React, { useEffect, useState } from "react";

/**
 * props:
 * - isAnswerPhase: boolean, indica si está en fase de respuesta
 * - onDiscussionEnd: callback cuando terminan los 30s de discusión
 * - onAnswerEnd: callback cuando terminan los 15s de respuesta
 * - discussionSeconds: segundos de discusión (default 30)
 * - answerSeconds: segundos de respuesta (default 15)
 */
const TimerInput = ({
  isAnswerPhase = false,
  onDiscussionEnd,
  onAnswerEnd,
  discussionSeconds = 30,
  answerSeconds = 15,
}) => {
  const [time, setTime] = useState(isAnswerPhase ? answerSeconds : discussionSeconds);

  useEffect(() => {
    setTime(isAnswerPhase ? answerSeconds : discussionSeconds);
  }, [isAnswerPhase, discussionSeconds, answerSeconds]);

  useEffect(() => {
    if (time === 0) {
      if (!isAnswerPhase) {
        onDiscussionEnd && onDiscussionEnd();
      } else {
        onAnswerEnd && onAnswerEnd();
      }
      return;
    }
    const timer = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(timer);
  }, [time, isAnswerPhase, onDiscussionEnd, onAnswerEnd]);

  return (
    <div style={{ fontSize: "2em", fontWeight: "bold", margin: "1em 0" }}>
      {isAnswerPhase
        ? `Tiempo para responder: ${time}s`
        : `Tiempo para discutir: ${time}s`}
    </div>
  );
};

export default TimerInput;