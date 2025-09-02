
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

/**
 * Prepara el contexto del capítulo 6.
 * - Selecciona (o reutiliza) al acaparador en rooms/{roomId}.selectedPlayerId
 * - Devuelve { hoarder }
 */
export const prepare = async ({ roomId, players }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  let selectedPlayerId = roomSnap.data()?.selectedPlayerId;

  if (!selectedPlayerId && players.length > 0) {
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    selectedPlayerId = randomPlayer.uid;
    await updateDoc(roomRef, { selectedPlayerId });
  }
  const hoarder = players.find(p => p.uid === selectedPlayerId) || null;
  return { hoarder };
};

/**
 * Contenido de precapítulo (pantalla “Listo”) específico para cap. 6
 */
export const getPreContent = ({ hoarder }) => ({
  title: "Capítulo 6 — Jugador seleccionado",
  highlight: hoarder?.username ?? "el acaparador",
  message: "Pulsa «Listo» cuando todos hayan leído la carta del capítulo 6.",
});

/**
 * Resolución de votación específica para cap. 6
 * - Si gana “eliminate_player”: elimina al acaparador de la lista de jugadores
 * - Si gana “save_player”: lo marca como salvado (solo para feedback/analytics)
 */
export const onVoteResolved = async ({ roomId, chapter, players, hoarder, winningOption }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);

  let eliminated = [];
  let saved = [];
  let announcements = [];

  if (winningOption === "eliminate_player" && hoarder) {
    const updatedPlayers = players.filter(p => p.uid !== hoarder.uid);
    await updateDoc(roomRef, { players: updatedPlayers });
    eliminated = [{ uid: hoarder.uid, name: hoarder.username }];
    announcements.push(`${hoarder.username} ha muerto.`);
  }

  if (winningOption === "save_player" && hoarder) {
    saved = [{ uid: hoarder.uid, name: hoarder.username }];
    announcements.push(`${hoarder.username} ha sido salvado.`);
  }

  const opt = chapter?.voteOptions?.find(o => o.id === winningOption);
  const text = opt?.text?.replace("{hoarder}", hoarder?.username ?? "el acaparador");

  return {
    announcements,
    eliminated,
    saved,
    feedbackText: opt?.feedback ?? (text ? `El grupo decidió: ${text}.` : null),
  };
};
