import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "./firebaseConfig";

/**
 * Aplica la resolución:
 * - En producción intenta usar la Cloud Function `applyResolution`.
 * - En desarrollo (Vite DEV) o si falla, usa fallback local para evitar CORS.
 * Devuelve { next: "LOBBY" | string | null }
 */
export async function applyResolution(roomId) {
  const isDev = import.meta.env.DEV;

  if (!isDev) {
    try {
      const apply = httpsCallable(functions, "applyResolution");
      const res = await apply({ roomId });
      return res.data; // { next: ... }
    } catch (_) {
      // si falla (CORS u otro), caemos al fallback local
    }
  }

  // ===== Fallback local (dev) =====
  const resRef = doc(db, "rooms", roomId, "meta", "lastResolution");
  const snap = await getDoc(resRef);
  if (!snap.exists()) throw new Error("No existe rooms/{roomId}/meta/lastResolution");

  const data = snap.data();
  const roomRef = doc(db, "rooms", roomId);

  if (data.gameOver) {
    await updateDoc(roomRef, { state: "LOBBY" });
    return { next: "LOBBY" };
  }

  if (data.groupIsCorrect && data.nextChapterId) {
    await updateDoc(roomRef, {
      currentChapter: data.nextChapterId,
      state: "OPEN",
    });
    await deleteDoc(resRef);
    return { next: data.nextChapterId };
  }

  return { next: null };
}
