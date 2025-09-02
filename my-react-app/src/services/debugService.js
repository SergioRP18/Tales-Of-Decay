// src/services/debugService.js
import { submitVoteAs } from "./voteService";
import { savePlayerAnswer } from "./gameStatsService";
import { setReady } from "./readyService";

/** Votos: bots imitan al humano. En cap12 solo vota el Salvador bot si corresponde. */
export async function mirrorBotsVote(roomId, players, optionId, chapter) {
  const bots = (players || []).filter((p) => p.isBot);
  if (!bots.length) return;

  if (chapter?.id === "chapter_12") {
    const saviorId = chapter.cap12?.roles?.saviorId;
    if (bots.some((b) => b.uid === saviorId)) {
      await submitVoteAs(roomId, saviorId, optionId);
    }
    return;
  }
  await Promise.all(bots.map((b) => submitVoteAs(roomId, b.uid, optionId)));
}

/** Decision: bots eligen lo mismo que el humano. */
export async function mirrorBotsAnswer(roomId, players, chapterId, optionId, isCorrect, responseTime) {
  const bots = (players || []).filter((p) => p.isBot);
  await Promise.all(
    bots.map((b) =>
      savePlayerAnswer(
        roomId,
        b.uid,
        b.username || "Bot",
        chapterId,
        optionId,
        !!isCorrect,
        responseTime ?? null
      )
    )
  );
}

/** PreCapítulo: bots marcan “Listo” para el capítulo actual */
export async function mirrorBotsReady(roomId, players, chapterId) {
  const bots = (players || []).filter((p) => p.isBot);
  await Promise.all(bots.map((b) => setReady(roomId, chapterId, b.uid, true)));
}
