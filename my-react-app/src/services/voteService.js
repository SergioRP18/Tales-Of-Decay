import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

export async function submitVote(roomId, playerId, optionId) {
  const db = getFirestore();
  await setDoc(doc(db, "rooms", roomId, "votes", playerId), {
    playerId,
    optionId,
    timestamp: Date.now()
  });
}

export async function getVotes(roomId) {
  const db = getFirestore();
  const votesCol = collection(db, "rooms", roomId, "votes");
  const snap = await getDocs(votesCol);
  return snap.docs.map(doc => doc.data());
}

export async function clearVotes(roomId) {
  const db = getFirestore();
  const votesCol = collection(db, "rooms", roomId, "votes");
  const snap = await getDocs(votesCol);
  for (const docSnap of snap.docs) {
    await deleteDoc(docSnap.ref);
  }
}