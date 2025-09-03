// src/pages/Game/chapters/ch20.js
// Capítulo 20 — Final: dos caminos y pantalla de Supervivientes.
// - type: "decision" (no elimina a nadie; ambas opciones son correctas)
// - feedback de sabor según la opción elegida
// - Game.jsx detecta chapter_20 y navega a la pantalla de Supervivientes

import { getFirestore, doc, getDoc } from "firebase/firestore";

export const prepare = async ({ roomId, players, chapter }) => {
  const db = getFirestore();

  // Blueprint estático si existe
  const chSnap = await getDoc(doc(db, "chapters", "chapter_20"));
  const meta = chSnap.exists()
    ? chSnap.data()
    : {
        id: "chapter_20",
        title: "Capítulo 20 — La Encrucijada",
        order: 20,
      };

  // Dos opciones, ambas correctas, con feedback de narrativa:
  const options = [
    {
      id: "other_path",
      text: "Buscar otro camino",
      isCorrect: true,
      // no seteamos nextChapter: terminamos en pantalla de Supervivientes
      feedback: "Se adentran en una comunidad.",
    },
    {
      id: "knock_door",
      text: "Tocar la puerta",
      isCorrect: true,
      feedback: "Siguen la eterna carretera.",
    },
  ];

  return {
    chapter: {
      ...chapter,
      id: meta.id,
      title: meta.title,
      order: meta.order,
      type: "decision",
      options,
      // narrativa opcional
      narrative:
        chapter?.narrative ||
        "Frente a ustedes hay una puerta y un sendero lateral. ¿Qué camino elegirán?",
    },
  };
};

// Opcional: puedes personalizar el precapítulo si quieres
export const getPreContent = ({ chapter }) => {
  return {
    title: chapter?.title || "Capítulo 20 — La Encrucijada",
    message:
      "El grupo enfrenta su última decisión. Tras elegir, se revelarán los supervivientes que llegaron al final.",
  };
};
