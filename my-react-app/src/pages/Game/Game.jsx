import React, { useEffect, useState } from "react";
import TimerInput from "../../components/TimerInput/TimerInput";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentChapter, advanceToNextChapter } from "../../services/chapterService";
import { submitVote, getVotes, clearVotes } from "../../services/voteService";
import { submitSacrifice } from "../../services/sacrificeService";
import { auth } from "../../services/firebaseConfig";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
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
  const [voteResults, setVoteResults] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hoarder, setHoarder] = useState(null); // Nuevo estado para el acaparador
  const [startTime, setStartTime] = useState(null);
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

  // Busca el username del jugador actual
  const currentPlayer = players.find(p => p.uid === auth.currentUser.uid);
  const username = currentPlayer ? currentPlayer.username : "Desconocido";

  // --- RESPUESTA NORMAL ---
  const handleTimerEnd = async () => {
    setOptionsEnabled(false);
    const responseTime = startTime ? Date.now() - startTime : null;

    if (!selectedOption) {
      await markPlayerEliminated(roomId, auth.currentUser.uid, chapter.id);
      navigate("/game-over", { state: { reason: "no-selection" } });
    } else if (chapter.type === "decision") {
      const chosen = chapter.options?.find(opt => opt.id === selectedOption);
      await savePlayerAnswer(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        !!chosen?.isCorrect,
        responseTime // <-- Nuevo parámetro
      );
      if (!chosen || !chosen.isCorrect) {
        navigate("/game-over", { state: { reason: "wrong-answer" } });
      } else {
        await advanceToNextChapter(roomId, chosen.nextChapter);
        window.location.reload();
      }
    } else if (chapter.type === "vote") {
      await savePlayerVote(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        responseTime // <-- Nuevo parámetro
      );
      await submitVote(roomId, auth.currentUser.uid, selectedOption);
      setOptionsEnabled(false);
    }
  };

  useEffect(() => {
    setStartTime(Date.now());
  }, [chapter]);

  if (loading) return <div>Cargando capítulo...</div>;
  if (!chapter) return <div>No se encontró el capítulo.</div>;

  return (
    <div className="gs">
      {/* Cabecera: título/subtítulo y timer arriba derecha */}
      <div className="gs-header">
        <div className="gs-titleBlock">
          <h1 className="gs-title">{chapter.title}</h1>
          {chapter.subtitle && <h2 className="gs-subtitle">{chapter.subtitle}</h2>}
          <div className="gs-skull" aria-hidden>☠</div>
        </div>
  
        <div className="gs-timer">
          <TimerInput
            isAnswerPhase={true}
            answerSeconds={45}
            onAnswerEnd={handleTimerEnd}
          />
        </div>
      </div>
  
      {/* Narrativa (puedes ocultarla si no va en esta pantalla) */}
      {chapter.narrative && (
        <p className="gs-narrative">
          {chapter.id === "chapter_06" && hoarder
            ? `El acaparador es: ${hoarder.username}. ${chapter.narrative}`
            : chapter.narrative}
        </p>
      )}
  
      {/* Opciones (decision / vote) */}
      <div className="gs-options">
        {chapter.type === "decision" && chapter.options?.map(opt => (
          <button
            key={opt.id}
            className={`gs-option ${selectedOption === opt.id ? "is-selected" : ""}`}
            disabled={!optionsEnabled}
            onClick={() => setSelectedOption(opt.id)}
          >
            {opt.text}
          </button>
        ))}
  
        {chapter.type === "vote" && chapter.id === "chapter_06" && chapter.voteOptions && !voteResults && (
          <>
            {chapter.voteOptions.map(opt => (
              <button
                key={opt.id}
                className={`gs-option ${selectedOption === opt.id ? "is-selected" : ""}`}
                disabled={!optionsEnabled}
                onClick={() => setSelectedOption(opt.id)}
              >
                {opt.text.replace("{hoarder}", hoarder ? hoarder.username : "el acaparador")}
              </button>
            ))}
          </>
        )}
  
        {chapter.type === "vote" && chapter.id !== "chapter_06" && chapter.voteOptions && !voteResults && (
          <>
            {chapter.voteOptions.map(opt => (
              <button
                key={opt.id}
                className={`gs-option ${selectedOption === opt.id ? "is-selected" : ""}`}
                disabled={!optionsEnabled}
                onClick={() => setSelectedOption(opt.id)}
              >
                {opt.text}
              </button>
            ))}
          </>
        )}
      </div>
  
      {/* Resultados de votación / sacrificio (tu contenido actual) */}
      {voteResults && (
        /* deja tu bloque de resultados como está, o muévelo a un modal */
        <div className="gs-results">{/* ...tu bloque actual... */}</div>
      )}
      {chapter.type === "sacrifice" && selectedOption && (
        <div className="gs-sacrifice">{/* ...tu bloque actual... */}</div>
      )}
      {chapter.type === "sacrifice" && !selectedOption && (
        <div className="gs-sacrificeOptions">{/* ...tu bloque actual... */}</div>
      )}
  
      {/* Pie: contador y logo */}
      <div className="gs-footer">
        <div className="gs-count">{(players?.length || 0)}/8</div>
        <img
          className="gs-logo"
          src="https://raw.githubusercontent.com/SergioRP18/Logo-The-Last-Card/63b41668478c96474e4e0ef35e1d5abee18ea249/Logo_ToD.svg"
          alt="Tales of Decay"
        />
      </div>
    </div>
  );
  
};

export default GameScreen;