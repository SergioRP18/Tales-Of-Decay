// src/services/gameStatsService.js
import {
  getFirestore, doc, setDoc, serverTimestamp, arrayUnion
} from "firebase/firestore";

/**
 * IMPORTANTE:
 * Firestore NO permite serverTimestamp() DENTRO de arrayUnion.
 * Usamos atMs: Date.now() dentro del array y mantenemos updatedAt con serverTimestamp().
 */

export async function savePlayerVote(roomId, uid, username, chapterId, optionId, responseTime) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "gameStats", uid);
  const nowMs = Date.now();
  await setDoc(ref, {
    uid,
    username,
    votes: arrayUnion({
      chapterId,
      optionId,
      responseTime: responseTime ?? null,
      atMs: nowMs,
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function savePlayerAnswer(roomId, uid, username, chapterId, optionId, isCorrect, responseTime) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "gameStats", uid);
  const nowMs = Date.now();
  await setDoc(ref, {
    uid,
    username,
    answers: arrayUnion({
      chapterId,
      optionId,
      isCorrect: !!isCorrect,
      responseTime: responseTime ?? null,
      atMs: nowMs,
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function markPlayerEliminated(roomId, uid, chapterId) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "gameStats", uid);
  const nowMs = Date.now();
  await setDoc(ref, {
    uid,
    eliminated: arrayUnion({
      chapterId,
      atMs: nowMs,
    }),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
