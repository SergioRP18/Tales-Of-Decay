// src/pages/Game/Game.jsx
import React, { useEffect, useState } from "react";
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
  writeBatch, // 👈 nuevo
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

  // ======= FEEDBACK ATÓMICO (soluciona cargando infinito) =======
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

    // Guardamos suficiente metadata para Feedback (desacoplado del blueprint)
    batch.set(
      resRef,
      {
        chapterId: chapter.id,
        chapterType: chapter.type || null,
        voteOptionsSnapshot: chapter.type === "vote" ? chapter.voteOptions || null : null,
        cap12Roles: chapter.cap12?.roles || null,

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

    // Cambiamos a FEEDBACK en el mismo commit
    batch.update(roomRef, { state: "FEEDBACK" });

    await batch.commit();
    navigate(`/feedback/${roomId}`);
  }
  // ===============================================================

  // Poll de votos (cap12 cierra con voto del Salvador)
  useEffect(() => {
    if (!chapter || chapter?.type !== "vote") return;
    const handler = getChapterHandler(chapter);

    const interval = setInterval(async () => {
      const votes = await getVotes(roomId);

      const saviorId = chapter.cap12?.roles?.saviorId;
      let ready = false;
      let relevantVotes = votes;

      if (chapter.id === "chapter_12" && saviorId) {
        relevantVotes = votes.filter((v) => v.playerId === saviorId);
        ready = relevantVotes.length >= 1;
      } else {
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
          const { announcements, eliminated, saved, feedbackText } =
            (await handler.onVoteResolved?.({
              roomId,
              chapter,
              players,
              hoarder,
              winningOption,
            })) || { announcements: [], eliminated: [], saved: [], feedbackText: null };

          await clearVotes(roomId);

          await showFeedback({
            groupOptionId: winningOption,
            feedbackText:
              feedbackText ||
              chapter.voteOptions?.find((o) => o.id === winningOption)?.feedback ||
              `El grupo decidió: ${winningOption}.`,
            announcements,
            saved,
            eliminated,
            groupIsCorrect: true,
            nextChapterId: chapter.nextChapter,
            gameOver: false,
          });
        }, 3000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [chapter, players, hoarder, roomId]);

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
      if (
        chapter?.id === "chapter_12" &&
        auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId
      ) {
        return; // espectador/salvado no se penaliza
      }
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
      if (chapter.id === "chapter_12" && auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId) {
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

  return (
    <div className="game">
      <h2 className="game__title">{chapter.title}</h2>
      <p className="game__narrative">{apply(chapter.narrative)}</p>

      <TimerInput isAnswerPhase={true} answerSeconds={3} onAnswerEnd={handleTimerEnd} />

      {/* DECISIÓN */}
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
                  auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId)
              }
              onClick={() => setSelectedOption(opt.id)}
              className={`btn-option ${selectedOption === opt.id ? "is-selected" : ""}`}
            >
              {apply(opt.text)}
            </button>
          ))}

          {chapter.id === "chapter_12" &&
            auth.currentUser?.uid !== chapter.cap12?.roles?.saviorId && (
              <p className="vote__waiting">Esperando la decisión del Salvador…</p>
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
          <button
            className="btn-option"
            onClick={async () => {
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

          <button className="btn-option btn-danger" onClick={() => removeBots(roomId)}>
            Quitar bots
          </button>
        </div>
      )}
    </div>
  );
};

export default GameScreen;
