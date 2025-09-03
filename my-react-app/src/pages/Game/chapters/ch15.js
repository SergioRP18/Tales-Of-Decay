// src/pages/Game/chapters/ch15.js
// Capítulo 15 — División en Hoguera (deciden) y Cabaña (espectadores).
// - Solo vota Hoguera
// - Se resuelve cuando TODOS los de Hoguera votan
// - "Delatar": muere Cabaña, pasan Hoguera  -> next: chapter_16_hoguera
// - "Mantener el silencio": muere Hoguera, pasan Cabaña -> next: chapter_16_cabana

import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

// Divide determinísticamente vivos en dos grupos usando su uid ordenado.
// Índices pares -> Hoguera, impares -> Cabaña
function splitIntoGroups(players) {
  const vivos = (players || []).filter((p) => !p.eliminated);
  const sorted = [...vivos].sort((a, b) => a.uid.localeCompare(b.uid));
  const bonfireIds = [];
  const cabinIds = [];
  sorted.forEach((p, i) => {
    if (i % 2 === 0) bonfireIds.push(p.uid);
    else cabinIds.push(p.uid);
  });
  return { bonfireIds, cabinIds, countAlive: vivos.length };
}

export const prepare = async ({ roomId, players, chapter }) => {
  const db = getFirestore();

  // Blueprint estático (si no existe el doc en "chapters/chapter_15", usamos fallback)
  const chSnap = await getDoc(doc(db, "chapters", "chapter_15"));
  const meta = chSnap.exists()
    ? chSnap.data()
    : {
        id: "chapter_15",
        title: "Capítulo 15 — La Decisión al Fuego",
        order: 15,
        // nextChapter aquí NO se usa: depende de la decisión; se calcula en onVoteResolved
      };

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data() || {};
  let cap15 = room.cap15;

  if (!cap15?.roles) {
    const roles = splitIntoGroups(players);
    cap15 = {
      roles: { bonfireIds: roles.bonfireIds, cabinIds: roles.cabinIds },
      phase: "pre",
      decision: null,
      seed: 15,
    };
    await updateDoc(roomRef, { cap15 });
  }

  const voteOptions = [
    {
      id: "betray",
      text: "Delatar a nuestros compañeros",
      feedback: "La Hoguera delató. La Cabaña muere; Hoguera avanza.",
    },
    {
      id: "silence",
      text: "Mantener el silencio",
      feedback: "La Hoguera calló. La Hoguera muere; Cabaña avanza.",
    },
  ];

  return {
    chapter: {
      ...chapter,
      id: meta.id,
      title: meta.title,
      order: meta.order,
      type: "vote",
      voteOptions,
      meta,
      cap15, // { roles:{ bonfireIds[], cabinIds[] }, phase, decision }
    },
  };
};

export const getPreContent = ({ chapter, players }) => {
  const cap15 = chapter?.cap15 || {};
  const hoguera = (players || [])
    .filter((p) => cap15.roles?.bonfireIds?.includes(p.uid))
    .map((p) => p.username);
  const cabana = (players || [])
    .filter((p) => cap15.roles?.cabinIds?.includes(p.uid))
    .map((p) => p.username);

  return {
    title: chapter?.title || "Capítulo 15 — La Decisión al Fuego",
    message: `Hoguera (deciden): ${hoguera.join(", ") || "—"}. Cabaña (espectadores): ${
      cabana.join(", ") || "—"
    }. Preparados para votar.`,
  };
};

export const onVoteResolved = async ({ roomId, players, chapter, winningOption }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);
  const { bonfireIds = [], cabinIds = [] } = chapter?.cap15?.roles || {};

  let eliminated = [];
  let saved = [];
  let feedbackText = "";
  let decision = null;
  let nextChapter = null;

  if (winningOption === "betray") {
    // Delatar: muere Cabaña, pasa Hoguera
    const victims = players.filter((p) => cabinIds.includes(p.uid));
    const survivors = players.filter((p) => !cabinIds.includes(p.uid));
    await updateDoc(roomRef, {
      players: survivors,
      cap15: { ...chapter.cap15, decision: "betray", phase: "feedback" },
    });
    eliminated = victims.map((p) => ({ uid: p.uid, name: p.username }));
    saved = players
      .filter((p) => bonfireIds.includes(p.uid))
      .map((p) => ({ uid: p.uid, name: p.username }));
    feedbackText = "La Hoguera delató. La Cabaña muere; Hoguera avanza.";
    decision = "betray";
    nextChapter = "chapter_16_hoguera";
  } else {
    // Silencio: muere Hoguera, pasa Cabaña
    const victims = players.filter((p) => bonfireIds.includes(p.uid));
    const survivors = players.filter((p) => !bonfireIds.includes(p.uid));
    await updateDoc(roomRef, {
      players: survivors,
      cap15: { ...chapter.cap15, decision: "silence", phase: "feedback" },
    });
    eliminated = victims.map((p) => ({ uid: p.uid, name: p.username }));
    saved = players
      .filter((p) => cabinIds.includes(p.uid))
      .map((p) => ({ uid: p.uid, name: p.username }));
    feedbackText = "La Hoguera calló. La Hoguera muere; Cabaña avanza.";
    decision = "silence";
    nextChapter = "chapter_16_cabana";
  }

  return { eliminated, saved, feedbackText, nextChapter, decision };
};
