// src/services/feedbackService.js
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Lee la última resolución del capítulo.
 */
export async function readLastResolution(roomId) {
  const db = getFirestore();
  const ref = doc(db, "rooms", roomId, "meta", "lastResolution");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Avanza de forma segura al siguiente capítulo o vuelve al lobby si no hay siguiente.
 */
export async function goToNextChapter(roomId, nextChapterId, fallbackChapterId) {
  const db = getFirestore();
  const nextId = nextChapterId || fallbackChapterId || null;

  if (nextId) {
    await updateDoc(doc(db, "rooms", roomId), {
      currentChapter: nextId,
      state: "PRECHAPTER",
    });
  } else {
    await setDoc(
      doc(db, "rooms", roomId, "meta", "lastResolution"),
      { gameOver: true, endedAt: serverTimestamp() },
      { merge: true }
    );
    await updateDoc(doc(db, "rooms", roomId), { state: "LOBBY" });
  }
}

/**
 * 🔹 Export que tu botón espera.
 * Decide a dónde navegar y hace los updates mínimos en Firestore.
 * Devuelve un string que tu `FeedbackScreen` usa en `onNavigate`:
 *  - "GAME_OVER_SELF"  -> navega a /game-over
 *  - "LOBBY"           -> navega a /lobby
 *  - "NEXT"            -> navega a /game/:roomId (siguiente capítulo)
 */
export async function applyResolution(roomId, { eliminatedSelf = false } = {}) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);
  const res = await readLastResolution(roomId);

  if (!res) return null;

  // Fin de juego
  if (res.gameOver) {
    if (eliminatedSelf) {
      return "GAME_OVER_SELF";
    }
    await updateDoc(roomRef, { state: "LOBBY" });
    return "LOBBY";
  }

  // Siguiente capítulo
  const nextId = res.nextChapterId || null;
  if (nextId) {
    await updateDoc(roomRef, {
      currentChapter: nextId,
      state: "PRECHAPTER",
    });
    return "NEXT";
  }

  // Fallback defensivo: sin nextChapter -> lobby
  await updateDoc(roomRef, { state: "LOBBY" });
  return "LOBBY";
}
