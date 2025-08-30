import { getFirestore, doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

export async function savePlayerAnswer(roomId, playerId, username, chapterId, selectedOption, isCorrect, responseTime) {
  const db = getFirestore();
  const statsRef = doc(db, "rooms", roomId, "gameStats", playerId);
  await setDoc(statsRef, {
    playerId,
    username,
    roomId,
    answers: arrayUnion({
      chapterId,
      selectedOption,
      isCorrect,
      responseTime, // <-- Guarda el tiempo de respuesta
      timestamp: Date.now()
    })
  }, { merge: true });

  if (!isCorrect && selectedOption === "eliminate_player") {
    const updatedPlayers = players.filter(p => p.uid !== playerId);
    await updateDoc(roomRef, { players: updatedPlayers });
  }
};

export async function savePlayerVote(roomId, playerId, username, chapterId, optionId, responseTime) {
  const db = getFirestore();
  const statsRef = doc(db, "rooms", roomId, "gameStats", playerId);
  await setDoc(statsRef, {
    playerId,
    username,
    roomId,
    votes: arrayUnion({
      chapterId,
      optionId,
      responseTime, // <-- Guarda el tiempo de respuesta
      timestamp: Date.now()
    })
  }, { merge: true });
}

export async function markPlayerEliminated(roomId, playerId, chapterId) {
  const db = getFirestore();
  const statsRef = doc(db, "rooms", roomId, "gameStats", playerId);
  await updateDoc(statsRef, {
    eliminatedAtChapter: chapterId,
    survived: false
  });
}

export async function markPlayerSurvived(roomId, playerId) {
  const db = getFirestore();
  const statsRef = doc(db, "rooms", roomId, "gameStats", playerId);
  await updateDoc(statsRef, {
    survived: true
  });
}