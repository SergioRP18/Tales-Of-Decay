import { getFirestore, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig";

// Función para unirse a una sala existente
export async function joinRoom(roomCode, username) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error("La sala no existe");
  }

  const player = {
    uid: auth.currentUser.uid,
    username,
    joinedAt: Date.now()
  };

  await updateDoc(roomRef, {
    players: arrayUnion(player)
  });
}