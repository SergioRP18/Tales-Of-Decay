// src/pages/Game/chapters/index.js
import * as common from "./common.js";
import * as ch03 from "./ch03.js";
import * as ch06 from "./ch06.js";
import * as ch09 from "./ch09.js";
import * as ch12 from "./ch12.js";

const map = {
  chapter_03: ch03,
  chapter_06: ch06,
  chapter_09: ch09,
  chapter_12: ch12,
};

export function getChapterHandler(chapter) {
  const h = chapter ? map[chapter.id] : null;
  return {
    applyTokens: common.applyTokens,
    prepare: h?.prepare || common.prepareDefault,
    getPreContent: h?.getPreContent || common.getPreContentDefault,
    onVoteResolved: h?.onVoteResolved || common.onVoteResolvedDefault,
  };
}
