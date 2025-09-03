// src/pages/Game/chapters/ch18.js
// Capítulo 18 — Muerte aleatoria (sin interacción)
// Flujo: PRECHAPTER -> (auto-resuelve) -> FEEDBACK
// - En prepare define víctima si aún no existe (determinística)
// - En autoResolve elimina a la víctima y retorna feedback + nextChapter

import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

// Selección determinística según roomId para que todos los clientes vean lo mismo
function pickDeterministic(uidList, roomId) {
  if (!uidList.length) return null;
  const sum = Array.from(roomId || "")
    .map((c) => c.charCodeAt(0))
    .reduce((a, b) => a + b, 0);
  const idx = sum % uidList.length;
  return uidList[idx];
}

export const prepare = async ({ roomId, players, chapter }) => {
  const db = getFirestore();

  // Lee blueprint estático si existe
  const chSnap = await getDoc(doc(db, "chapters", "chapter_18"));
  const meta = chSnap.exists()
    ? chSnap.data()
    : {
        id: "chapter_18",
        title: "Capítulo 18 — La Parca",
        order: 18,
        nextChapter: "chapter_19",
      };

  // Estado efímero en room
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data() || {};
  let cap18 = room.cap18;

  // Si no hay víctima elegida, elegir una de los vivos y persistir
  if (!cap18?.victimId) {
    const vivos = (players || []).filter((p) => !p.eliminated);
    const sorted = [...vivos].sort((a, b) => a.uid.localeCompare(b.uid));
    const victimId = pickDeterministic(sorted.map((p) => p.uid), roomId);

    cap18 = {
      victimId: victimId || null,
      phase: "pre",
      seed: 18,
    };
    await updateDoc(roomRef, { cap18 });
  }

  // Este capítulo es "auto": el Game.jsx no pide input, llama a autoResolve y navega a feedback
  return {
    chapter: {
      ...chapter,
      id: meta.id,
      title: meta.title,
      order: meta.order,
      nextChapter: meta.nextChapter,
      type: "auto",
      cap18, // { victimId, phase, seed }
    },
  };
};

export const getPreContent = ({ chapter, players }) => {
  // Mostramos mensaje de tensión, sin revelar a la víctima aún
  return {
    title: chapter?.title || "Capítulo 18 — La Parca",
    message:
      "La noche reclama una vida. El destino elegirá a uno de ustedes al azar… Prepárense para conocer el resultado.",
  };
};

export const autoResolve = async ({ roomId, players, chapter }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);

  const victimId = chapter?.cap18?.victimId || null;
  const victim = (players || []).find((p) => p.uid === victimId) || null;

  let eliminated = [];
  let saved = [];
  let feedbackText = "";

  if (victim) {
    const survivors = players.filter((p) => p.uid !== victim.uid);
    await updateDoc(roomRef, {
      players: survivors,
      cap18: { ...chapter.cap18, phase: "feedback" },
    });

    eliminated = [{ uid: victim.uid, name: victim.username }];
    saved = survivors.map((p) => ({ uid: p.uid, name: p.username }));
    feedbackText = `${victim.username} fue asesinado al azar.`;
  } else {
    // Si por alguna razón no hubiera víctima válida (sala vacía, etc.), solo pasar al siguiente
    feedbackText = "Nadie fue elegido. La noche parece haber tenido piedad…";
  }

  return {
    eliminated,
    saved,
    feedbackText,
    nextChapter: chapter?.nextChapter || "chapter_19",
  };
};
