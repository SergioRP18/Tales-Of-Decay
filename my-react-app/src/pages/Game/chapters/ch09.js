// src/pages/Game/chapters/ch09.js
import { getFirestore, doc, updateDoc } from "firebase/firestore";

/**
 * Capítulo 9: votación por jugador a sacrificar.
 * - Genera voteOptions dinámicos a partir de la lista de jugadores
 *   (id = uid del jugador, text = nombre visible).
 * - Devuelve un "patch" de capítulo para que Game.jsx lo use directamente.
 */
export const prepare = async ({ chapter, players }) => {
  const voteOptions = (players || []).map(p => ({
    id: p.uid,
    text: p.username || p.uid,
    // feedback para el ganador (opcional, igual lo reforzamos en onVoteResolved)
    feedback: `${p.username || "Alguien"} ha sido sacrificado.`
  }));

  return {
    // devolvemos un capítulo parcheado con las opciones dinámicas
    chapter: { ...chapter, voteOptions }
  };
};

export const getPreContent = () => ({
  title: "Capítulo 9 — Votación de sacrificio",
  message: "Todos votan quién debe ser sacrificado. Confirmad que entienden las reglas."
});

/**
 * Cuando termina la votación:
 * - 'winningOption' es el uid del jugador más votado.
 * - Se elimina a ese jugador de rooms/{roomId}.players
 */
export const onVoteResolved = async ({ roomId, players, winningOption }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);

  const victim = players.find(p => p.uid === winningOption) || null;
  const updatedPlayers = victim ? players.filter(p => p.uid !== victim.uid) : players;
  await updateDoc(roomRef, { players: updatedPlayers });

  const name = victim?.username || "Alguien";
  return {
    announcements: [`${name} ha sido sacrificado por votación.`],
    eliminated: victim ? [{ uid: victim.uid, name }] : [],
    saved: [],
    feedbackText: `${name} ha sido sacrificado.`
  };
};
