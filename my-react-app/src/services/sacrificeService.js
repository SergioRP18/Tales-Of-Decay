import { getFirestore, doc, setDoc } from "firebase/firestore";

export async function submitSacrifice(roomId, sacrificedPlayerId, decisionMakerId) {
  const db = getFirestore();
  await setDoc(doc(db, "rooms", roomId, "sacrifices", sacrificedPlayerId), {
    sacrificedPlayerId,
    decisionMakerId,
    timestamp: Date.now()
  });
}