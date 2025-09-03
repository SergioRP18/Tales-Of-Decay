// src/pages/Game/Game.jsx
import React, { useEffect, useRef, useState } from "react";
import TimerInput from "../../components/TimerInput/TimerInput";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentChapter } from "../../services/chapterService";
import { submitVote, getVotes, clearVotes, submitVoteAs } from "../../services/voteService";
import { submitSacrifice } from "../../services/sacrificeService";
import { auth } from "../../services/firebaseConfig";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  savePlayerAnswer,
  savePlayerVote,
  markPlayerEliminated,
} from "../../services/gameStatsService";
import { getChapterHandler } from "./chapters/index.js";
import { seedBots, removeBots } from "../../services/roomService";
import { mirrorBotsVote, mirrorBotsAnswer } from "../../services/debugService";

import "./game.css";

const GameScreen = () => {
  const { roomId } = useParams();
  const [chapter, setChapter] = useState(null);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteResults, setVoteResults] = useState(null);
  const [players, setPlayers] = useState([]);
  const [hoarder, setHoarder] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [roomState, setRoomState] = useState(null);

  const [dbg, setDbg] = useState({
    show: import.meta.env.DEV,
    mirror: localStorage.getItem("mirrorBots") === "1",
  });
  const toggleMirror = () => {
    const v = !dbg.mirror;
    localStorage.setItem("mirrorBots", v ? "1" : "0");
    setDbg((s) => ({ ...s, mirror: v }));
  };

  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    const fetchChapter = async () => {
      setLoading(true);
      try {
        const data = await getCurrentChapter(roomId);
        setChapter(data);

        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const roomData = roomSnap.data() || {};
        const loadedPlayers = roomData.players || [];
        setPlayers(loadedPlayers);
        setRoomState(roomData.state || null);

        const handler = getChapterHandler(data);
        const ctx =
          (await handler.prepare?.({ roomId, players: loadedPlayers, chapter: data })) || {};
        setHoarder(ctx.hoarder ?? null);
        if (ctx.chapter) setChapter(ctx.chapter);

        setSelectedOption(null);
        setVoteResults(null);
        setOptionsEnabled(true);
      } catch {
        setChapter(null);
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [roomId, db]);

  useEffect(() => {
    if (roomState && roomState !== "PLAY") {
      navigate(`/precapitulo/${roomId}`);
    }
  }, [roomState, navigate, roomId]);

  async function showFeedback({
    groupOptionId,
    feedbackText,
    announcements = [],
    saved = [],
    eliminated = [],
    nextChapterId = null,
    groupIsCorrect = false,
    gameOver = false,
  }) {
    const resRef = doc(db, "rooms", roomId, "meta", "lastResolution");
    const roomRef = doc(db, "rooms", roomId);

    const eliminatedIds = new Set(eliminated.map((p) => p.uid));
    const survivors = (players || [])
      .filter((p) => !eliminatedIds.has(p.uid))
      .map((p) => ({ uid: p.uid, name: p.username }));

    const batch = writeBatch(db);

    batch.set(
      resRef,
      {
        chapterId: chapter.id,
        chapterType: chapter.type || null,
        voteOptionsSnapshot: chapter.type === "vote" ? chapter.voteOptions || null : null,
        cap12Roles: chapter.cap12?.roles || null,
        cap15Roles: chapter.cap15?.roles || null,

        groupOptionId,
        groupIsCorrect,
        feedback: feedbackText,
        announcements,
        saved,
        eliminated,
        survivors,
        nextChapterId,
        gameOver,
        resolvedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Capítulo 20: en vez de Feedback, vamos a Supervivientes
    if (chapter?.id === "chapter_20") {
      batch.update(roomRef, { state: "SURVIVORS" });
      await batch.commit();
      navigate(`/supervivientes/${roomId}`);
      return;
    }

    // Resto de capítulos → Feedback
    batch.update(roomRef, { state: "FEEDBACK" });
    await batch.commit();
    navigate(`/feedback/${roomId}`);
  }

  // =================== AUTO-RESOLVE (capítulos type: "auto") ===================
  const autoOnceRef = useRef(false);
  useEffect(() => {
    if (!chapter || chapter.type !== "auto") return;
    if (autoOnceRef.current) return;
    autoOnceRef.current = true;

    const handler = getChapterHandler(chapter);
    (async () => {
      const res =
        (await handler.autoResolve?.({ roomId, players, chapter })) || {
          announcements: [],
          eliminated: [],
          saved: [],
          feedbackText: "El capítulo fue resuelto automáticamente.",
          nextChapter: chapter.nextChapter || null,
        };

      await showFeedback({
        groupOptionId: "auto",
        feedbackText: res.feedbackText,
        announcements: res.announcements || [],
        saved: res.saved || [],
        eliminated: res.eliminated || [],
        groupIsCorrect: true,
        nextChapterId: res.nextChapter || chapter.nextChapter || null,
        gameOver: false,
      });
    })();
  }, [chapter, players]); // eslint-disable-line
  // ============================================================================

  // =================== POLL DE VOTOS (vote) ===================
  useEffect(() => {
    if (!chapter || chapter?.type !== "vote") return;
    const handler = getChapterHandler(chapter);

    const interval = setInterval(async () => {
      const votes = await getVotes(roomId);

      let ready = false;
      let relevantVotes = votes;

      // Cap 12: cierra cuando vota el Salvador
      if (chapter.id === "chapter_12" && chapter.cap12?.roles?.saviorId) {
        const saviorId = chapter.cap12.roles.saviorId;
        relevantVotes = votes.filter((v) => v.playerId === saviorId);
        ready = relevantVotes.length >= 1;
      }
      // Cap 15: solo Hoguera; cierra cuando TODOS los de Hoguera votan
      else if (chapter.id === "chapter_15" && chapter.cap15?.roles?.bonfireIds) {
        const bonfireIds = chapter.cap15.roles.bonfireIds || [];
        relevantVotes = votes.filter((v) => bonfireIds.includes(v.playerId));
        ready = bonfireIds.length > 0 && relevantVotes.length === bonfireIds.length;
      }
      // Resto: espera a todos
      else {
        ready = votes.length === players.length && players.length > 0;
      }

      if (ready) {
        const counts = {};
        const votersByOption = {};
        relevantVotes.forEach((v) => {
          counts[v.optionId] = (counts[v.optionId] || 0) + 1;
          const playerName = players.find((p) => p.uid === v.playerId)?.username || v.playerId;
          if (!votersByOption[v.optionId]) votersByOption[v.optionId] = [];
          votersByOption[v.optionId].push(playerName);
        });
        const [winningOption] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

        setVoteResults({ counts, winningOption, votersByOption });
        setOptionsEnabled(false);

        setTimeout(async () => {
          const res =
            (await handler.onVoteResolved?.({
              roomId,
              chapter,
              players,
              hoarder,
              winningOption,
            })) || {
              announcements: [],
              eliminated: [],
              saved: [],
              feedbackText: null,
              nextChapter: null,
            };

          await clearVotes(roomId);

          await showFeedback({
            groupOptionId: winningOption,
            feedbackText:
              res.feedbackText ||
              chapter.voteOptions?.find((o) => o.id === winningOption)?.feedback ||
              `El grupo decidió: ${winningOption}.`,
            announcements: res.announcements || [],
            saved: res.saved || [],
            eliminated: res.eliminated || [],
            groupIsCorrect: true,
            nextChapterId: res.nextChapter || chapter.nextChapter || null,
            gameOver: false,
          });
        }, 3000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [chapter, players, hoarder, roomId]);
  // =============================================================

  const handleSacrifice = async (sacrificedPlayerId) => {
    setOptionsEnabled(false);
    setSelectedOption(sacrificedPlayerId);
    await submitSacrifice(roomId, sacrificedPlayerId, auth.currentUser.uid);

    setTimeout(async () => {
      const sacrificed = players.find((p) => p.uid === sacrificedPlayerId);
      await showFeedback({
        groupOptionId: "sacrifice",
        feedbackText: `${sacrificed?.username || "Alguien"} ha sido sacrificado.`,
        announcements: [`${sacrificed?.username || sacrificedPlayerId} ha sido sacrificado.`],
        eliminated: [{ uid: sacrificedPlayerId, name: sacrificed?.username }],
        groupIsCorrect: true,
        nextChapterId: chapter.nextChapter,
        gameOver: false,
      });
    }, 2000);
  };

  const currentPlayer = players.find((p) => p.uid === auth.currentUser.uid);
  const username = currentPlayer ? currentPlayer.username : "Desconocido";

  const handleTimerEnd = async () => {
    setOptionsEnabled(false);
    const responseTime = startTime ? Date.now() - startTime : null;

    if (!selectedOption) {
      // Espectadores no penalizados en cap 12/15
      const isCap12Spectator =
        chapter?.id === "chapter_12" &&
        auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId;

      const isCap15Spectator =
        chapter?.id === "chapter_15" &&
        !(chapter.cap15?.roles?.bonfireIds || []).includes(auth.currentUser?.uid);

      // En capítulos "auto" no hay selección; no se penaliza.
      if (chapter?.type === "auto" || isCap12Spectator || isCap15Spectator) return;

      await markPlayerEliminated(roomId, auth.currentUser.uid, chapter.id);
      await showFeedback({
        groupOptionId: "no-selection",
        feedbackText: "No eliges a tiempo. La indecisión te condena.",
        announcements: [`${username} ha muerto.`],
        eliminated: [{ uid: auth.currentUser.uid, name: username }],
        groupIsCorrect: false,
        nextChapterId: null,
        gameOver: true,
      });
      return;
    }

    if (chapter.type === "decision") {
      const chosen = chapter.options?.find((opt) => opt.id === selectedOption);

      await savePlayerAnswer(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        !!chosen?.isCorrect,
        responseTime
      );

      if (dbg.mirror) {
        await mirrorBotsAnswer(
          roomId,
          players,
          chapter.id,
          selectedOption,
          !!chosen?.isCorrect,
          responseTime
        );
      }

      // En cap 20, ambas opciones son correctas y vamos a Supervivientes
      if (chapter?.id === "chapter_20") {
        await showFeedback({
          groupOptionId: selectedOption,
          feedbackText: chosen?.feedback || "El grupo alcanza su destino.",
          announcements: [],
          eliminated: [],
          groupIsCorrect: true,
          nextChapterId: null,
          gameOver: true, // final de juego
        });
        return;
      }

      if (!chosen || !chosen.isCorrect) {
        await showFeedback({
          groupOptionId: selectedOption,
          feedbackText: chosen?.feedback || "La ruta elegida resulta fatal.",
          announcements: [`${username} ha muerto.`],
          eliminated: [{ uid: auth.currentUser.uid, name: username }],
          groupIsCorrect: false,
          nextChapterId: null,
          gameOver: true,
        });
      } else {
        await showFeedback({
          groupOptionId: selectedOption,
          feedbackText: chosen.feedback || "El grupo toma la ruta correcta y avanza.",
          announcements: [],
          eliminated: [],
          groupIsCorrect: true,
          nextChapterId: chosen.nextChapter,
          gameOver: false,
        });
      }
      return;
    }

    if (chapter.type === "vote") {
      // Cap 12: solo el Salvador vota
      if (chapter.id === "chapter_12" && auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId) {
        return;
      }
      // Cap 15: solo Hoguera vota
      if (
        chapter.id === "chapter_15" &&
        !(chapter.cap15?.roles?.bonfireIds || []).includes(auth.currentUser?.uid)
      ) {
        return;
      }

      await savePlayerVote(
        roomId,
        auth.currentUser.uid,
        username,
        chapter.id,
        selectedOption,
        responseTime
      );
      await submitVote(roomId, auth.currentUser.uid, selectedOption);

      if (dbg.mirror) {
        await mirrorBotsVote(roomId, players, selectedOption, chapter);
      }
    }
  };

  useEffect(() => {
    setStartTime(Date.now());
  }, [chapter]);

  if (loading) return <div className="page-loading">Cargando capítulo...</div>;
  if (!chapter) return <div className="page-loading">No se encontró el capítulo.</div>;
  if (roomState && roomState !== "PLAY") return null;

  const handler = getChapterHandler(chapter);
  const apply = (txt) => handler.applyTokens?.(txt, { hoarder }) ?? txt;

  const isBonfire =
    chapter?.id === "chapter_15" &&
    (chapter.cap15?.roles?.bonfireIds || []).includes(auth.currentUser?.uid);
  const isCabin =
    chapter?.id === "chapter_15" &&
    (chapter.cap15?.roles?.cabinIds || []).includes(auth.currentUser?.uid);

  // ===== helper de debug: resolver cap 15 sin votar (sirve si sos espectador) =====
  const resolveCap15 = async (opt /* "betray" | "silence" */) => {
    const res =
      (await handler.onVoteResolved?.({
        roomId,
        chapter,
        players,
        hoarder,
        winningOption: opt,
      })) || {
        announcements: [],
        eliminated: [],
        saved: [],
        feedbackText: null,
        nextChapter: null,
      };

    await clearVotes(roomId);

    await showFeedback({
      groupOptionId: opt,
      feedbackText:
        res.feedbackText ||
        chapter.voteOptions?.find((o) => o.id === opt)?.feedback ||
        `El grupo decidió: ${opt}.`,
      announcements: res.announcements || [],
      saved: res.saved || [],
      eliminated: res.eliminated || [],
      groupIsCorrect: true,
      nextChapterId: res.nextChapter || chapter.nextChapter || null,
      gameOver: false,
    });
  };

  // Si el capítulo es "auto", no mostramos UI (cap 18)
  if (chapter?.type === "auto") {
    return <div className="page-loading">Resolviendo…</div>;
  }

  return (
    <div className="game">
      <h2 className="game__title">{chapter.title}</h2>
      <p className="game__narrative">{apply(chapter.narrative)}</p>

      <TimerInput isAnswerPhase={true} answerSeconds={45} onAnswerEnd={handleTimerEnd} />

      {/* DECISION NORMAL */}
      {chapter.type === "decision" && chapter.options && (
        <div className="options">
          {chapter.options.map((opt) => (
            <button
              key={opt.id}
              disabled={!optionsEnabled}
              onClick={() => setSelectedOption(opt.id)}
              className={`btn-option ${selectedOption === opt.id ? "is-selected" : ""}`}
            >
              {apply(opt.text)}
            </button>
          ))}
        </div>
      )}

      {/* VOTACIÓN */}
      {chapter.type === "vote" && chapter.voteOptions && !voteResults && (
        <div className="options">
          <p className="vote__prompt">
            {chapter.id === "chapter_12"
              ? (() => {
                  const savName =
                    players.find((p) => p.uid === chapter.cap12?.roles?.saviorId)?.username ||
                    "el Salvador";
                  return `Decisión del Salvador (${savName})`;
                })()
              : chapter.id === "chapter_15"
              ? "Decisión del grupo de la Hoguera"
              : hoarder
              ? `¿Qué hacer con ${hoarder.username}?`
              : "Vota tu opción:"}
          </p>

          {chapter.voteOptions.map((opt) => (
            <button
              key={opt.id}
              disabled={
                !optionsEnabled ||
                (chapter.id === "chapter_12" &&
                  auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId) ||
                (chapter.id === "chapter_15" && !isBonfire)
              }
              onClick={() => setSelectedOption(opt.id)}
              className={`btn-option ${selectedOption === opt.id ? "is-selected" : ""}`}
            >
              {apply(opt.text)}
            </button>
          ))}

          {chapter.id === "chapter_15" && isCabin && (
            <p className="vote__waiting">Estás en Cabaña: esperando la decisión de la Hoguera…</p>
          )}
        </div>
      )}

      {/* Resultados de la votación */}
      {voteResults && (
        <div className="vote-results card card--dark animate-in">
          <h2 className="vote-results__title">¡Votación finalizada!</h2>
          {chapter.voteOptions.map((opt) => {
            const winner = voteResults.winningOption === opt.id;
            return (
              <div key={opt.id} className={`vote-option ${winner ? "vote-option--winner" : ""}`}>
                <span>
                  {apply(opt.text)}: <b>{voteResults.counts[opt.id] || 0} votos</b>
                </span>
                <br />
                <span className="vote-option__voters">
                  {voteResults.votersByOption?.[opt.id]?.length > 0
                    ? "Votaron: " + voteResults.votersByOption[opt.id].join(", ")
                    : ""}
                </span>
                {winner && <span className="vote-option__badge">← Ganador</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Sacrificio */}
      {chapter.type === "sacrifice" && selectedOption && (
        <div className="sacrifice card card--danger animate-in">
          <h2 className="sacrifice__title">¡Sacrificio realizado!</h2>
          <p>
            <b>{players.find((p) => p.uid === selectedOption)?.username || "Jugador"}</b> ha sido
            sacrificado.
          </p>
          <p className="sacrifice__by">
            Decisión tomada por:{" "}
            <b>{players.find((p) => p.uid === auth.currentUser.uid)?.username || "Alguien"}</b>
          </p>
        </div>
      )}

      {chapter.type === "sacrifice" && !selectedOption && (
        <div className="options">
          <p>Selecciona a quién sacrificar:</p>
          {players.map((player) => (
            <button
              key={player.uid}
              disabled={!optionsEnabled}
              onClick={() => handleSacrifice(player.uid)}
              className="btn-option"
            >
              {player.username}
            </button>
          ))}
        </div>
      )}

      {/* ===== Debug Bar (solo DEV) ===== */}
      {dbg.show && (
        <div className="debug-bar" style={{ marginTop: 16, opacity: 0.85 }}>
          <button className="btn-option" onClick={() => seedBots(roomId, 7)}>
            +7 bots (DEV)
          </button>
          <button className="btn-option" onClick={toggleMirror}>
            {dbg.mirror ? "Mirror bots: ON" : "Mirror bots: OFF"}
          </button>

          {/* DBG: por defecto, si estás en cap 15, resolver "Delatar" */}
          <button
            className="btn-option"
            onClick={async () => {
              if (chapter?.id === "chapter_15") {
                await resolveCap15("betray");
                return;
              }
              await clearVotes(roomId);
              await showFeedback({
                groupOptionId: "debug-skip",
                feedbackText: "DEBUG: saltar capítulo",
                announcements: [],
                saved: [],
                eliminated: [],
                groupIsCorrect: true,
                nextChapterId: chapter.nextChapter,
                gameOver: false,
              });
            }}
          >
            Siguiente capítulo (DBG)
          </button>

          {/* Cap 12: forzar voto del Salvador */}
          {chapter?.id === "chapter_12" &&
            auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId && (
              <>
                <button
                  className="btn-option"
                  onClick={() => submitVoteAs(roomId, chapter.cap12.roles.saviorId, "help")}
                >
                  Forzar voto Salvador: Ayudar
                </button>
                <button
                  className="btn-option"
                  onClick={() => submitVoteAs(roomId, chapter.cap12.roles.saviorId, "run")}
                >
                  Forzar voto Salvador: Correr
                </button>
              </>
            )}

          {/* Cap 15: resolver sin ser de Hoguera (aparece para TODOS) */}
          {chapter?.id === "chapter_15" && (
            <>
              <button
                className="btn-option"
                onClick={() => resolveCap15("betray")}
                title="Fuerza la decisión de la Hoguera: Delatar (mata Cabaña, pasa Hoguera)"
              >
                Resolver cap 15: Delatar (DBG)
              </button>
              <button
                className="btn-option"
                onClick={() => resolveCap15("silence")}
                title="Fuerza la decisión de la Hoguera: Mantener el silencio (mata Hoguera, pasa Cabaña)"
              >
                Resolver cap 15: Silencio (DBG)
              </button>
            </>
          )}

          <button className="btn-option btn-danger" onClick={() => removeBots(roomId)}>
            Quitar bots
          </button>
        </div>
      )}
    </div>
  );
  
};

export default GameScreen;
