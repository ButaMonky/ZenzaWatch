//===BEGIN===
/**
 * Probable stacked-comment art: display metadata only, never destructive deduplication.
 * Marker/multiline scoring and author/time grouping are informed by niconicomments keepCA.
 * This conservative Zenza implementation keeps existing font/scale rules and source data.
 */
class CommentArtProtection {
  static analyze(chats, {enabled = true} = {}) {
    const result = new Map();
    if (!enabled) { return result; }
    const authors = new Map();
    for (const chat of chats) {
      if (!chat || Number(chat.fork) === 1 || chat.isInvisible || chat.isDeleted || chat.isNicoScript) { continue; }
      const author = chat.userId, date = chat.date, layer = chat.layerId;
      if (author == null || ['', '0', '-1'].includes(String(author)) ||
          !Number.isFinite(date) || date <= 0 || !Number.isInteger(layer) ||
          !Number.isFinite(chat.vpos) || chat.vpos < 0) { continue; }
      const mail = typeof chat.cmd === 'string' ? chat.cmd.toLowerCase().split(/\s+/) : [];
      const marked = chat.isCA || chat.isPatissier || chat.isFull || chat.isEnder ||
        mail.some(word => ['ca', 'patissier', 'pattisier', 'full', 'ender'].includes(word));
      const breaks = (String(chat.text || '').match(/\r\n|\n|\r/g) || []).length;
      const score = (marked ? 5 : 0) + (breaks > 2 ? breaks / 2 : 0);
      if (!score) { continue; }
      // Opaque author/thread IDs are grouping keys only; never exported or placed in CSS.
      const key = JSON.stringify([String(chat.threadId), Number(chat.fork), layer, String(author)]);
      let bucket = authors.get(key);
      if (!bucket) { bucket = []; authors.set(key, bucket); }
      bucket.push({chat, score, date});
    }
    let layerNumber = 0;
    for (const key of [...authors.keys()].sort()) {
      const bucket = authors.get(key).sort((a,b) => a.date-b.date || a.chat.vpos-b.chat.vpos || String(a.chat.no).localeCompare(String(b.chat.no)));
      let cluster = [], anchor = 0, score = 0;
      const finish = () => {
        if (score < 10) { return; }
        // A string namespace cannot collide with the validated numeric original layers.
        const layerId = 'zenza-ca/' + layerNumber++;
        for (const {chat} of cluster) {
          result.set(chat, Object.freeze({layerId, group: layerId + '/' + chat.type + '/' + chat.vpos}));
        }
      };
      for (const entry of bucket) {
        if (cluster.length && entry.date - anchor > 300) {
          finish(); cluster = []; score = 0;
        }
        if (!cluster.length) { anchor = entry.date; }
        cluster.push(entry); score += entry.score;
      }
      finish();
    }
    return result;
  }
}
//===END===
export {CommentArtProtection};
