// src/pages/Game/chapters/ch12.js
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const deriveRoles = (players) => {
  const vivos = (players || []).filter((p) => !p.eliminated);
  const sorted = [...vivos].sort((a, b) => a.uid.localeCompare(b.uid));

  const a = sorted[0] || null;
  const b = sorted[1] || null;
  const c = sorted[2] || null;

  // Si hay 3, el tercero es Salvador; con 2 o 1, el primero.
  const savior = c || a || null;
  const savedIds = [a, b]
    .filter(Boolean)
    .filter((p) => p.uid !== savior?.uid)
    .map((p) => p.uid);

  return { countAlive: vivos.length, saviorId: savior?.uid || null, savedIds };
};

export const prepare = async ({ roomId, players, chapter }) => {
  const db = getFirestore();

  const chSnap = await getDoc(doc(db, "chapters", "chapter_12"));
  const meta = chSnap.exists()
    ? chSnap.data()
    : { id: "chapter_12", nextChapter: "chapter_13", title: "Capítulo 12 — La Fosa", type: "sacrifice", sacrificeType: "hero_choice" };

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data() || {};
  let cap12 = room.cap12;

  if (!cap12?.roles) {
    const roles = deriveRoles(players);

    if (!roles.saviorId) {
      return {
        chapter: {
          ...chapter,
          id: meta.id,
          title: meta.title,
          order: meta.order,
          nextChapter: meta.nextChapter,
          type: "decision",
          options: [{ id: "continue", text: "Continuar", isCorrect: true, nextChapter: meta.nextChapter }],
          narrative: "No hay jugadores suficientes para este capítulo. Continúa al siguiente.",
        },
      };
    }

    cap12 = { roles: { saviorId: roles.saviorId, savedIds: roles.savedIds }, phase: "pre", decision: null, seed: 12 };
    await updateDoc(roomRef, { cap12 });
  }

  const voteOptions = [
    { id: "help", text: "Ayudar a mis compañeros", feedback: "El Salvador se sacrifica; los Salvados viven." },
    { id: "run",  text: "Correr por mi vida",       feedback: "El Salvador vive; los Salvados mueren." },
  ];

  return {
    chapter: {
      ...chapter,
      id: meta.id,
      title: meta.title,
      order: meta.order,
      nextChapter: meta.nextChapter,
      type: "vote",
      voteOptions,
      meta,
      cap12,
    },
  };
};

export const getPreContent = ({ chapter, players }) => {
  const cap12 = chapter?.cap12 || {};
  const savior = (players || []).find((p) => p.uid === cap12.roles?.saviorId);
  const savedNames = (players || [])
    .filter((p) => cap12.roles?.savedIds?.includes(p.uid))
    .map((p) => p.username);

  const savedLabel =
    savedNames.length === 0 ? "nadie" :
    savedNames.length === 1 ? savedNames[0] : savedNames.join(" y ");

  return {
    title: chapter?.title || "Capítulo 12 — La Fosa",
    message: `Caen: ${savedLabel}. Salvador: ${savior?.username || "Alguien"}. Cuando estén listos, pasen a la votación.`,
  };
};

export const onVoteResolved = async ({ roomId, players, chapter, winningOption }) => {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomId);
  const { saviorId, savedIds } = chapter?.cap12?.roles || {};

  let eliminated = [];
  let saved = [];
  let feedbackText = "";

  if (winningOption === "help") {
    if (saviorId) {
      const survivors = players.filter((p) => p.uid !== saviorId);
      await updateDoc(roomRef, { players: survivors, cap12: { ...chapter.cap12, decision: "help", phase: "feedback" } });
      const savior = players.find((p) => p.uid === saviorId);
      eliminated = savior ? [{ uid: savior.uid, name: savior.username }] : [];
    } else {
      await updateDoc(roomRef, { cap12: { ...chapter.cap12, decision: "help", phase: "feedback" } });
    }
    saved = players.filter((p) => savedIds?.includes(p.uid)).map((p) => ({ uid: p.uid, name: p.username }));
    feedbackText = "El Salvador se sacrificó. Los Salvados viven.";
  } else {
    const victims = players.filter((p) => savedIds?.includes(p.uid));
    if (victims.length > 0) {
      const survivors = players.filter((p) => !savedIds?.includes(p.uid));
      await updateDoc(roomRef, { players: survivors, cap12: { ...chapter.cap12, decision: "run", phase: "feedback" } });
      eliminated = victims.map((p) => ({ uid: p.uid, name: p.username }));
    } else {
      await updateDoc(roomRef, { cap12: { ...chapter.cap12, decision: "run", phase: "feedback" } });
    }
    const savior = players.find((p) => p.uid === saviorId);
    saved = savior ? [{ uid: savior.uid, name: savior.username }] : [];
    feedbackText = "El Salvador huyó. Los Salvados murieron.";
  }

  return { eliminated, saved, feedbackText, nextChapter: chapter.nextChapter || "chapter_13" };
};
