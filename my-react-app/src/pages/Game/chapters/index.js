
import * as common from "./common.js";
import * as ch03 from "./ch03.js";
import * as ch06 from "./ch06.js";
import * as ch09 from "./ch09.js";


const map = {
  chapter_03: ch03,
  chapter_06: ch06,
  chapter_09: ch09,
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
