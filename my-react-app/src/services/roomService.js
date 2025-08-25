import { getFirestore, doc, setDoc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig";

// Genera un código de sala aleatorio de 6 caracteres
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Crea una sala y retorna el código
export async function createRoom(hostUsername) {
  const db = getFirestore();
  let roomCode = generateRoomCode();

  // Verifica que el código no exista (muy poco probable, pero seguro)
  let exists = true;
  while (exists) {
    const roomSnap = await getDoc(doc(db, "rooms", roomCode));
    if (!roomSnap.exists()) exists = false;
    else roomCode = generateRoomCode();
  }

  const hostPlayer = {
    uid: auth.currentUser.uid,
    username: hostUsername,
    joinedAt: Date.now(),
    isHost: true
  };

  await setDoc(doc(db, "rooms", roomCode), {
    players: [hostPlayer],
    status: "waiting",
    createdAt: Date.now(),
    currentChapter: "chapter_01" // <-- ¡Agrega esta línea!
  });

  return roomCode;
}

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