// src/services/readyService.js
import {
    getFirestore,
    doc,
    setDoc,
    getDocs,
    collection,
    deleteDoc,
    serverTimestamp,
  } from "firebase/firestore";
  
  /**
   * Guardamos "Listo" namespeado por capítulo:
   * rooms/{roomId}/chapterReadies/{chapterId}/players/{playerId}
   */
  
  export async function setReady(roomId, chapterId, playerId, ready = true) {
    const db = getFirestore();
    const ref = doc(db, "rooms", roomId, "chapterReadies", chapterId, "players", playerId);
    await setDoc(ref, { playerId, ready: !!ready, at: serverTimestamp() });
  }
  
  export async function getReadies(roomId, chapterId) {
    const db = getFirestore();
    const col = collection(db, "rooms", roomId, "chapterReadies", chapterId, "players");
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data()); // [{playerId, ready, at}]
  }
  
  export async function clearReadies(roomId, chapterId) {
    const db = getFirestore();
    const col = collection(db, "rooms", roomId, "chapterReadies", chapterId, "players");
    const snap = await getDocs(col);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  