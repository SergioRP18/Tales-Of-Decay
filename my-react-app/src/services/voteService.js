// src/services/voteService.js
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

/** Vota como el jugador autenticado */
export async function submitVote(roomId, playerId, optionId) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "votes", playerId);
  await setDoc(ref, { playerId, optionId, at: serverTimestamp() });
}

/** ⚙️ Helper: votar “como si fueras” otro jugador (bot) */
export async function submitVoteAs(roomId, playerId, optionId) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "votes", playerId);
  await setDoc(ref, { playerId, optionId, at: serverTimestamp() });
}

/** Lee todos los votos de la sala */
export async function getVotes(roomId) {
  const db = getFirestore();
  const snap = await getDocs(collection(db, "rooms", roomId, "votes"));
  return snap.docs.map((d) => d.data()); // { playerId, optionId, at }
}

/** Limpia todos los votos de la sala */
export async function clearVotes(roomId) {
  const db = getFirestore();
  const snap = await getDocs(collection(db, "rooms", roomId, "votes"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
