import React, { useEffect, useState } from "react";
import TimerInput from "../../components/TimerInput/TimerInput";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentChapter } from "../../services/chapterService"; // ← quitamos advanceToNextChapter aquí
import { submitVote, getVotes, clearVotes } from "../../services/voteService";
import { submitSacrifice } from "../../services/sacrificeService";
import { auth } from "../../services/firebaseConfig";
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  savePlayerAnswer,
  savePlayerVote,
  markPlayerEliminated
} from "../../services/gameStatsService";

const GameScreen = () => {
  const { roomId } = useParams();
  const [chapter, setChapter] = useState(null);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPreChapter, setShowPreChapter] = useState(true);
  const [voteResults, setVoteResults] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hoarder, setHoarder] = useState(null); // jugador seleccionado cap 3/6
  const [startTime, setStartTime] = useState(null);
  const navigate = useNavigate();

  // Carga capítulo y jugadores
  useEffect(() => {
    const fetchChapter = async () => {
      setLoading(true);
      try {
        const data = await getCurrentChapter(roomId);
        setChapter(data);

        const db = getFirestore();
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const loadedPlayers = roomSnap.data().players || [];
        setPlayers(loadedPlayers);

        if (data.id === "chapter_03" || data.id === "chapter_06") {
          let selectedPlayerId = roomSnap.data().selectedPlayerId;

          if (!selectedPlayerId && loadedPlayers.length > 0) {
            const randomPlayer = loadedPlayers[Math.floor(Math.random() * loadedPlayers.length)];
            selectedPlayerId = randomPlayer.uid;
            await updateDoc(roomRef, { selectedPlayerId });
          }

          const selectedPlayer = loadedPlayers.find(p => p.uid === selectedPlayerId);
          setHoarder(selectedPlayer);
        } else {
          setHoarder(null);
        }
      } catch (e) {
        setChapter(null);
      }
      setSelectedOption(null);
      setVoteResults(null);
      setOptionsEnabled(true);
      setLoading(false);
    };
    fetchChapter();
  }, [roomId]);

  // Helper: publicar Feedback y navegar
  async function showFeedback({
    groupOptionId,
    feedbackText,
    announcements = [],
    saved = [],
    eliminated = [],
    nextChapterId = null,
    groupIsCorrect = false,
    gameOver = false
  }) {
    const db = getFirestore();
    const resRef = doc(db, "rooms", roomId, "meta", "lastResolution");

    // survivors = jugadores actuales menos eliminados
    const eliminatedIds = new Set(eliminated.map(p => p.uid));
    const survivors = (players || [])
      .filter(p => !eliminatedIds.has(p.uid))
      .map(p => ({ uid: p.uid, name: p.username }));

    await setDoc(resRef, {
      chapterId: chapter.id,
      groupOptionId,
      groupIsCorrect,
      feedback: feedbackText,
      announcements,
      saved,
      eliminated,
      survivors,
      nextChapterId,
      gameOver,
      resolvedAt: serverTimestamp()
    }, { merge: true });

    // Marcar estado FEEDBACK para bloquear inputs
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, { state: "FEEDBACK" });

    navigate(`/feedback/${roomId}`);
  }

  // --- VOTACIÓN (TODOS los capítulos de tipo vote) ---
  useEffect(() => {
    if (chapter?.type === "vote") {
      const interval = setInterval(async () => {
        const votes = await getVotes(roomId);
        if (votes.length === players.length && players.length > 0) {
          // Conteo
          const counts = {};
          const votersByOption = {};
          votes.forEach(v => {
            counts[v.optionId] = (counts[v.optionId] || 0) + 1;
            const playerName = players.find(p => p.uid === v.playerId)?.username || v.playerId;
            if (!votersByOption[v.optionId]) votersByOption[v.optionId] = [];
            votersByOption[v.optionId].push(playerName);
          });
          const winningOption = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          setVoteResults({ counts, winningOption, votersByOption });
          setOptionsEnabled(false);

          setTimeout(async () => {
            // Feedback desde la opción ganadora (si definiste feedback en voteOptions)
            const winning = (chapter.voteOptions || []).find(o => o.id === winningOption);
            const feedbackText = winning?.feedback
              ? winning.feedback
              : `El grupo decidió: ${winning ? winning.text : winningOption}.`;

            let announcements = [];
            let eliminatedList = [];
            let savedList = [];

            // Reglas especiales cap 3/6 con "acaparador"
            if ((chapter.id === "chapter_03" || chapter.id === "chapter_06") && hoarder) {
              const dbx = getFirestore();
              const roomRef = doc(dbx, "rooms", roomId);

              if (winningOption === "eliminate_player") {
                const updatedPlayers = players.filter(p => p.uid !== hoarder.uid);
                await updateDoc(roomRef, { players: updatedPlayers });
                eliminatedList = [{ uid: hoarder.uid, name: hoarder.username }];
                announcements.push(`${hoarder.username} ha muerto.`);
              }
              if (winningOption === "save_player") {
                savedList = [{ uid: hoarder.uid, name: hoarder.username }];
                announcements.push(`${hoarder.username} ha sido salvado.`);
              }
            }

            await clearVotes(roomId);

            await showFeedback({
              groupOptionId: winningOption,
              feedbackText,
              announcements,
              saved: savedList,
              eliminated: eliminatedList,
              groupIsCorrect: true,
              nextChapterId: chapter.nextChapter,
              gameOver: false
            });
          }, 3000);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [chapter, players.length, roomId, players, hoarder]);

  // --- SACRIFICIO ---
  const handleSacrifice = async (sacrificedPlayerId) => {
    setOptionsEnabled(false);
    setSelectedOption(sacrificedPlayerId);
    await submitSacrifice(roomId, sacrificedPlayerId, auth.currentUser.uid);
    setTimeout(async () => {
      const sacrificed = players.find(p => p.uid === sacrificedPlayerId);
      await showFeedback({
        groupOptionId: "sacrifice",
        feedbackText: `${sacrificed?.username || "Alguien"} ha sido sacrificado.`,
        announcements: [`${sacrificed?.username || sacrificedPlayerId} ha sido sacrificado.`],
        eliminated: [{ uid: sacrificedPlayerId, name: sacrificed?.username }],
        groupIsCorrect: true,
        nextChapterId: chapter.nextChapter,
        gameOver: false
      });
    }, 2000);
  };

  // Busca username actual
  const currentPlayer = players.find(p => p.uid === auth.currentUser.uid);
  const username = currentPlayer ? currentPlayer.username : "Desconocido";

  // --- RESPUESTA NORMAL (decision) ---
  const handleTimerEnd = async () => {
    setOptionsEnabled(false);
    const responseTime = startTime ? Date.now() - startTime : null;

    if (!selectedOption) {
      await markPlayerEliminated(roomId, auth.currentUser.uid, chapter.id);
      // AHORA: Feedback antes de perder
      await showFeedback({
        groupOptionId: "no-selection",
        feedbackText: "No eliges a tiempo. La indecisión te condena.",
        announcements: [`${username} ha muerto.`],
        eliminated: [{ uid: auth.currentUser.uid, name: username }],
        groupIsCorrect: false,
        nextChapterId: null,
        gameOver: true
      });
    } else if (chapter.type === "decision") {
      const chosen = chapter.options?.find(opt => opt.id === selectedOption);
      await savePlayerAnswer(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        !!chosen?.isCorrect,
        responseTime
      );

      if (!chosen || !chosen.isCorrect) {
        // AHORA: Feedback antes de GameOver
        await showFeedback({
          groupOptionId: selectedOption,
          feedbackText: chosen?.feedback || "La ruta elegida resulta fatal.",
          announcements: [`${username} ha muerto.`],
          eliminated: [{ uid: auth.currentUser.uid, name: username }],
          groupIsCorrect: false,
          nextChapterId: null,
          gameOver: true
        });
      } else {
        // AHORA: Feedback antes de avanzar
        await showFeedback({
          groupOptionId: selectedOption,
          feedbackText: chosen.feedback || "El grupo toma la ruta correcta y avanza.",
          announcements: [],
          eliminated: [],
          groupIsCorrect: true,
          nextChapterId: chosen.nextChapter,
          gameOver: false
        });
      }
    } else if (chapter.type === "vote") {
      await savePlayerVote(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        responseTime
      );
      await submitVote(roomId, auth.currentUser.uid, selectedOption);
      setOptionsEnabled(false);
      // El avance real se hará cuando el intervalo de votos detecte que todos votaron (arriba)
    }
  };

  useEffect(() => {
    setStartTime(Date.now());
  }, [chapter]);

  if (loading) return <div>Cargando capítulo...</div>;
  if (!chapter) return <div>No se encontró el capítulo.</div>;

  // Pantalla especial cap 3/6
  if ((chapter.id === "chapter_03" || chapter.id === "chapter_06") && hoarder && showPreChapter) {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", textAlign: "center", padding: "2em",
        }}
      >
        <h2>Jugador seleccionado</h2>
        <p style={{ fontSize: "1.5em", marginBottom: "2em", color: "#ffd700" }}>
          {hoarder.username}
        </p>
        <button
          onClick={() => setShowPreChapter(false)}
          style={{
            padding: "1em 2em", backgroundColor: "#ffd700", border: "none",
            borderRadius: "12px", fontSize: "1.2em", cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          Seguir
        </button>
      </div>
    );
  }

  if (showPreChapter) {
    const db = getFirestore();
    const roomRef = doc(db, "rooms", roomId);

    // Al presionar "Listo"
    const handleReady = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return;

      const roomData = roomSnap.data();
      const updatedPlayers = (roomData.players || []).map(p =>
        p.uid === user.uid ? { ...p, readyForChapter: true } : p
      );

      await updateDoc(roomRef, { players: updatedPlayers });

      // Si todos están listos, reset y mostrar capítulo
      const allReady = updatedPlayers.every(p => p.readyForChapter);
      if (allReady) {
        const resetPlayers = updatedPlayers.map(p => ({ ...p, readyForChapter: false }));
        await updateDoc(roomRef, { players: resetPlayers });
        setShowPreChapter(false);
      }
    };

    return (
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", textAlign: "center", padding: "2em",
        }}
      >
        <h2>{chapter.title}</h2>
        <p style={{ fontSize: "1.2em", marginBottom: "2em" }}>
          Antes de oprimir "Listo", leer la carta del capítulo correspondiente y asegurarse de que todos entiendan.
        </p>
        <button
          onClick={handleReady}
          style={{
            padding: "1em 2em", backgroundColor: "#ffd700", border: "none",
            borderRadius: "12px", fontSize: "1.2em", cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          Listo
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>{chapter.title}</h2>
      <p>
        {chapter.id === "chapter_06" && hoarder
          ? `El acaparador es: ${hoarder.username}. ${chapter.narrative}`
          : chapter.narrative}
      </p>
      <TimerInput
        isAnswerPhase={true}
        answerSeconds={10}
        onAnswerEnd={handleTimerEnd}
      />

      {/* DECISIÓN */}
      {chapter.type === "decision" && chapter.options && (
        <div>
          {chapter.options.map(opt => (
            <button
              key={opt.id}
              disabled={!optionsEnabled}
              onClick={() => setSelectedOption(opt.id)}
              style={{
                background: selectedOption === opt.id ? "#ffd700" : undefined,
                color: selectedOption === opt.id ? "#222" : undefined,
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      )}

      {/* VOTACIÓN cap 6 */}
      {chapter.type === "vote" && chapter.id === "chapter_06" && chapter.voteOptions && !voteResults && (
        <div>
          <p>¿Qué hacer con {hoarder ? hoarder.username : "el acaparador"}?</p>
          {chapter.voteOptions.map(opt => (
            <button
              key={opt.id}
              disabled={!optionsEnabled}
              onClick={() => setSelectedOption(opt.id)}
              style={{
                background: selectedOption === opt.id ? "#ffd700" : undefined,
                color: selectedOption === opt.id ? "#222" : undefined,
              }}
            >
              {opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")}
            </button>
          ))}
        </div>
      )}

      {/* VOTACIÓN otros capítulos */}
      {chapter.type === "vote" && chapter.id !== "chapter_06" && chapter.voteOptions && !voteResults && (
        <div>
          <p>Vota tu opción:</p>
          {chapter.voteOptions.map(opt => (
            <button
              key={opt.id}
              disabled={!optionsEnabled}
              onClick={() => setSelectedOption(opt.id)}
              style={{
                background: selectedOption === opt.id ? "#ffd700" : undefined,
                color: selectedOption === opt.id ? "#222" : undefined,
              }}
            >
              {opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")}
            </button>
          ))}
        </div>
      )}

      {/* Resultados de la votación (visual) */}
      {voteResults && (
        <div
          style={{
            margin: "2em auto",
            padding: "2em",
            background: "#222",
            borderRadius: "16px",
            maxWidth: 400,
            color: "#fff",
            boxShadow: "0 0 16px #0008",
            animation: "fadeInScale 1s"
          }}
        >
          <h2 style={{ color: "#ffd700" }}>¡Votación finalizada!</h2>
          {chapter.voteOptions.map(opt => (
            <div
              key={opt.id}
              style={{
                margin: "1em 0",
                padding: "1em",
                borderRadius: "8px",
                background:
                  voteResults.winningOption === opt.id
                    ? "linear-gradient(90deg, #ffd700 60%, #fffbe6 100%)"
                    : "#333",
                color: voteResults.winningOption === opt.id ? "#222" : "#fff",
                fontWeight: voteResults.winningOption === opt.id ? "bold" : "normal",
                fontSize: voteResults.winningOption === opt.id ? "1.2em" : "1em",
                transition: "all 0.3s"
              }}
            >
              <span>
                {chapter.id === "chapter_06"
                  ? opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")
                  : opt.text}
                : <b>{voteResults.counts[opt.id] || 0} votos</b>
              </span>
              <br />
              <span style={{ fontSize: "0.9em" }}>
                {voteResults.votersByOption?.[opt.id]?.length > 0
                  ? "Votaron: " + voteResults.votersByOption[opt.id].join(", ")
                  : ""}
              </span>
              {voteResults.winningOption === opt.id && (
                <span style={{ marginLeft: 8, color: "#b8860b" }}> ← Ganador</span>
              )}
            </div>
          ))}
          <style>
            {`
              @keyframes fadeInScale {
                0% { opacity: 0; transform: scale(0.8);}
                100% { opacity: 1; transform: scale(1);}
              }
            `}
          </style>
        </div>
      )}

      {/* Resultado de sacrificio */}
      {chapter.type === "sacrifice" && selectedOption && (
        <div
          style={{
            margin: "2em auto",
            padding: "2em",
            background: "#3a1c1c",
            borderRadius: "16px",
            maxWidth: 400,
            color: "#fff",
            boxShadow: "0 0 16px #0008",
            animation: "fadeInScale 1s"
          }}
        >
          <h2 style={{ color: "#ff4c4c" }}>¡Sacrificio realizado!</h2>
          <p>
            <b>
              {players.find(p => p.uid === selectedOption)?.username || "Jugador"}
            </b>{" "}
            ha sido sacrificado.
          </p>
          <p style={{ fontSize: "0.9em" }}>
            Decisión tomada por:{" "}
            <b>
              {players.find(p => p.uid === auth.currentUser.uid)?.username || "Alguien"}
            </b>
          </p>
          <style>
            {`
              @keyframes fadeInScale {
                0% { opacity: 0; transform: scale(0.8);}
                100% { opacity: 1; transform: scale(1);}
              }
            `}
          </style>
        </div>
      )}

      {/* Botones de sacrificio */}
      {chapter.type === "sacrifice" && !selectedOption && (
        <div>
          <p>Selecciona a quién sacrificar:</p>
          {players.map(player => (
            <button
              key={player.uid}
              disabled={!optionsEnabled}
              onClick={() => handleSacrifice(player.uid)}
            >
              {player.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameScreen;
