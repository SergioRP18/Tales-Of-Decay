import React, { useEffect, useState } from "react";
import TimerInput from "../../components/TimerInput/TimerInput";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentChapter, advanceToNextChapter } from "../../services/chapterService";
import { submitVote, getVotes, clearVotes } from "../../services/voteService";
import { submitSacrifice } from "../../services/sacrificeService";
import { auth } from "../../services/firebaseConfig";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const GameScreen = () => {
  const { roomId } = useParams();
  const [chapter, setChapter] = useState(null);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteResults, setVoteResults] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hoarder, setHoarder] = useState(null); // Nuevo estado para el acaparador
  const navigate = useNavigate();

  // Carga el capítulo actual y jugadores al montar o cuando roomId cambia
  useEffect(() => {
    const fetchChapter = async () => {
      setLoading(true);
      try {
        const data = await getCurrentChapter(roomId);
        setChapter(data);
        // Carga jugadores
        const db = getFirestore();
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const loadedPlayers = roomSnap.data().players || [];
        setPlayers(loadedPlayers);

        // --- Lógica especial para capítulo 6 ---
        if (data.id === "chapter_06") {
          let hoarderId = roomSnap.data().hoarderId;
          // Si no hay acaparador, elige uno aleatorio y guárdalo en room
          if (!hoarderId && loadedPlayers.length > 0) {
            const randomPlayer = loadedPlayers[Math.floor(Math.random() * loadedPlayers.length)];
            hoarderId = randomPlayer.uid;
            await updateDoc(roomRef, { hoarderId });
          }
          // Busca el jugador acaparador y guárdalo en estado
          const hoarderPlayer = loadedPlayers.find(p => p.uid === hoarderId);
          setHoarder(hoarderPlayer);
        } else {
          setHoarder(null);
        }
      } catch (e) {
        setChapter(null);
      }
      setSelectedOption(null);
      setVoteResults(null);
      setOptionsEnabled(true); // Habilita opciones al cargar capítulo
      setLoading(false);
    };
    fetchChapter();
  }, [roomId]);

  // --- VOTACIÓN ---
  useEffect(() => {
    if (chapter?.type === "vote") {
      const interval = setInterval(async () => {
        const votes = await getVotes(roomId);
        if (votes.length === players.length && players.length > 0) {
          // Calcula resultado
          const counts = {};
          const votersByOption = {};
          votes.forEach(v => {
            counts[v.optionId] = (counts[v.optionId] || 0) + 1;
            const playerName =
              players.find(p => p.uid === v.playerId)?.username || v.playerId;
            if (!votersByOption[v.optionId]) votersByOption[v.optionId] = [];
            votersByOption[v.optionId].push(playerName);
          });
          const winningOption = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          setVoteResults({ counts, winningOption, votersByOption });
          setOptionsEnabled(false);

          setTimeout(async () => {
            // --- Lógica especial para capítulo 6: eliminar acaparador si es "matar" ---
            if (
              chapter.id === "chapter_06" &&
              winningOption === "kill_hoarder" &&
              hoarder
            ) {
              const db = getFirestore();
              const roomRef = doc(db, "rooms", roomId);
              // Filtra al acaparador del array de jugadores
              const updatedPlayers = players.filter(p => p.uid !== hoarder.uid);
              await updateDoc(roomRef, { players: updatedPlayers });
            }
            await clearVotes(roomId);
            await advanceToNextChapter(roomId, chapter.nextChapter);
            window.location.reload();
          }, 3000); // 3 segundos para mostrar resultados
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
      await advanceToNextChapter(roomId, chapter.nextChapter);
      window.location.reload();
    }, 2000);
  };

  // --- RESPUESTA NORMAL ---
  const handleTimerEnd = async () => {
    setOptionsEnabled(false);
    if (!selectedOption) {
      navigate("/game-over", { state: { reason: "no-selection" } });
    } else if (chapter.type === "decision") {
      const chosen = chapter.options?.find(opt => opt.id === selectedOption);
      if (!chosen || !chosen.isCorrect) {
        navigate("/game-over", { state: { reason: "wrong-answer" } });
      } else {
        await advanceToNextChapter(roomId, chosen.nextChapter);
        window.location.reload();
      }
    } else if (chapter.type === "vote") {
      await submitVote(roomId, auth.currentUser.uid, selectedOption);
      setOptionsEnabled(false);
    }
  };

  if (loading) return <div>Cargando capítulo...</div>;
  if (!chapter) return <div>No se encontró el capítulo.</div>;

  return (
    <div>
      <h2>{chapter.title}</h2>
      <p>
        {/* Personaliza la narrativa para capítulo 6 */}
        {chapter.id === "chapter_06" && hoarder
          ? `El acaparador es: ${hoarder.username}. ${chapter.narrative}`
          : chapter.narrative}
      </p>
      <TimerInput
        isAnswerPhase={true}
        answerSeconds={30}
        onAnswerEnd={handleTimerEnd}
      />

      {/* DECISION NORMAL */}
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

      {/* VOTACIÓN - Capítulo 6 personalizado */}
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
              {/* Reemplaza {hoarder} en el texto de la opción */}
              {opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")}
            </button>
          ))}
        </div>
      )}

      {/* VOTACIÓN - Otros capítulos */}
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
              {opt.text}
            </button>
          ))}
        </div>
      )}

      {/* Resultados de la votación */}
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
                {/* Personaliza el texto de resultado para capítulo 6 */}
                {chapter.id === "chapter_06"
                  ? opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")
                  : opt.text}
                : <b>{voteResults.counts[opt.id] || 0} votos</b>
              </span>
              <br />
              <span style={{ fontSize: "0.9em" }}>
                {voteResults.votersByOption?.[opt.id]?.length > 0
                  ? "Votaron: " +
                    voteResults.votersByOption[opt.id].join(", ")
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
              {players.find(p => p.uid === auth.currentUser.uid)?.username ||
                "Alguien"}
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