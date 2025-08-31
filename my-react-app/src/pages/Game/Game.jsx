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
  const [showPreChapter, setShowPreChapter] = useState(true);
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

        // Cargar jugadores
        const db = getFirestore();
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const loadedPlayers = roomSnap.data().players || [];
        setPlayers(loadedPlayers);

        // Lógica especial para capítulos 3 y 6
        if (data.id === "chapter_03" || data.id === "chapter_06") {
          let selectedPlayerId = roomSnap.data().selectedPlayerId;

          if (!selectedPlayerId && loadedPlayers.length > 0) {
            const randomPlayer = loadedPlayers[Math.floor(Math.random() * loadedPlayers.length)];
            selectedPlayerId = randomPlayer.uid;
            await updateDoc(roomRef, { selectedPlayerId });
          }

          // Buscar jugador seleccionado
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

  // Si estamos en capítulo 3 o 6, y el jugador actual es el seleccionado (hoarder)
// if (
//   (chapter.id === "chapter_03" || chapter.id === "chapter_06") &&
//   hoarder &&
//   auth.currentUser.uid === hoarder.uid &&
//   !voteResults
// ) {
//   return (
//     <div style={{ textAlign: "center", marginTop: "20vh" }}>
//       <h2>Has sido seleccionado...</h2>
//       <p>Espera mientras los demás deciden tu destino.</p>
//     </div>
//   );
// };

  // --- VOTACIÓN ---
  useEffect(() => {
    if (chapter?.type === "vote" && (chapter.id === "chapter_03" || chapter.id === "chapter_06")) {
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
            // --- Lógica especial para capítulo 3 y 6: eliminar o salvar ---
            if (
              (chapter.id === "chapter_03" || chapter.id === "chapter_06") &&
              winningOption === "eliminate_player" &&
              hoarder
            ) {
              const db = getFirestore();
              const roomRef = doc(db, "rooms", roomId);

              // Filtra al jugador eliminado
              const updatedPlayers = players.filter(p => p.uid !== hoarder.uid);
              await updateDoc(roomRef, { players: updatedPlayers });

              // 👇 Si el jugador actual es el eliminado, mándalo a GameOver
              if (auth.currentUser.uid === hoarder.uid) {
                navigate("/game-over", { state: { reason: "eliminated" } });
                return;
              }
            }

            if (
              (chapter.id === "chapter_03" || chapter.id === "chapter_06") &&
              winningOption === "save_player" &&
              hoarder
            ) {
              // 👇 Si el jugador actual es el salvado, mándalo a GameOver pero con mensaje de salvado
              if (auth.currentUser.uid === hoarder.uid) {
                navigate("/game-over", { state: { reason: "saved" } });
                return;
              }
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

  // Pantalla especial para capítulos 3 y 6
if ((chapter.id === "chapter_03" || chapter.id === "chapter_06") && hoarder && showPreChapter) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        padding: "2em",
      }}
    >
      <h2>Jugador seleccionado</h2>
      <p style={{ fontSize: "1.5em", marginBottom: "2em", color: "#ffd700" }}>
        {hoarder.username}
      </p>
      <button
        onClick={() => setShowPreChapter(false)}
        style={{
          padding: "1em 2em",
          backgroundColor: "#ffd700",
          border: "none",
          borderRadius: "12px",
          fontSize: "1.2em",
          cursor: "pointer",
          boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
        }}
      >
        Seguir
      </button>
    </div>
  );
};


  if (showPreChapter) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);

  // Función al presionar "Listo"
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

    // Verificar si todos están listos
    const allReady = updatedPlayers.every(p => p.readyForChapter);
    if (allReady) {
      // Reseteamos readyForChapter para la siguiente ronda
      const resetPlayers = updatedPlayers.map(p => ({
        ...p,
        readyForChapter: false,
      }));
      await updateDoc(roomRef, { players: resetPlayers });

      // Avanzamos a la pantalla del capítulo
      setShowPreChapter(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        padding: "2em",
      }}
    >
      {/*aparece el título del capítulo */}
      <h2>{chapter.title}</h2>
      <p style={{ fontSize: "1.2em", marginBottom: "2em" }}>
        Antes de oprimir "Listo", leer la carta del capítulo correspondiente y asegurarse de que todos entiendan.
      </p>
      <button
        onClick={handleReady}
        style={{
          padding: "1em 2em",
          backgroundColor: "#ffd700",
          border: "none",
          borderRadius: "12px",
          fontSize: "1.2em",
          cursor: "pointer",
          boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
        }}
      >
        Listo
      </button>
    </div>
  );
};


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