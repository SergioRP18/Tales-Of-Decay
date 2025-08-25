import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

// Obtiene el capítulo actual de la sala
export async function getCurrentChapter(roomId) {
  const db = getFirestore();
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) throw new Error("Room not found");
  const { currentChapter } = roomSnap.data();
  if (!currentChapter) throw new Error("No currentChapter in room");
  const chapterSnap = await getDoc(doc(db, "chapters", currentChapter));
  if (!chapterSnap.exists()) throw new Error("Chapter not found");
  return chapterSnap.data();
}

// Avanza al siguiente capítulo
export async function advanceToNextChapter(roomId, nextChapterId) {
  const db = getFirestore();
  await updateDoc(doc(db, "rooms", roomId), {
    currentChapter: nextChapterId
  });
}