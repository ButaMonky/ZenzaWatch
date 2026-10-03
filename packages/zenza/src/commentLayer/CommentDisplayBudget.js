//===BEGIN===
/*
 * Task 206: 同時表示コメント数の予算（取得件数・保持件数とは別）。
 * - 上限判定は「新しく表示を開始する直前」だけに使う。表示を始めた要素は寿命まで消さない。
 * - owner(fork1)・自分の投稿（投稿中/失敗を含む）は上限の対象外で、数にも入れない。
 * - 優先度: 今回の通常取得 > 増量で追加した過去コメント、各グループ内は 通常 > かんたん > AI。
 *   低い優先度ほど「表示中の総数がこの割合未満なら受け入れる」天井を低くし、
 *   増量分やかんたん/AIが枠を埋め尽くしても、通常コメント用の枠が残るようにする。
 */
class CommentDisplayBudget {
  static get CONFIG_KEY() { return 'commentLayer.maxDisplayComment'; }
  static get CHOICES() { return [40, 100, 200, 400, 800]; }
  static get DEFAULT() { return 200; }
  static get TIER() {
    return {EXEMPT: -1, MAIN: 0, EASY: 1, AI: 2, HISTORY_MAIN: 3, HISTORY_EASY: 4, HISTORY_AI: 5};
  }
  static get TIER_NAMES() {
    return ['main', 'easy', 'ai', 'historyMain', 'historyEasy', 'historyAi'];
  }
  /* 各優先度が受け入れられる「表示中総数」の天井（上限に対する割合） */
  static get CEILING_RATIO() { return [1, 0.9, 0.85, 0.75, 0.7, 0.7]; }

  static normalizeLimit(value) {
    const n = Number(value);
    return CommentDisplayBudget.CHOICES.includes(n) ? n : CommentDisplayBudget.DEFAULT;
  }
  static isValidLimit(value) {
    return typeof value === 'number' && CommentDisplayBudget.CHOICES.includes(value);
  }
  static isExempt(chat) {
    if (!chat) { return false; }
    return Number(chat.fork) === 1 || !!chat.isMine || !!chat.isUpdating || !!chat.isPostFail;
  }
  static tierOf(chat, isHistory = false) {
    const T = CommentDisplayBudget.TIER;
    if (CommentDisplayBudget.isExempt(chat)) { return T.EXEMPT; }
    const fork = Number(chat.fork);
    const kind = fork === 2 ? T.EASY : (fork === 3 ? T.AI : T.MAIN);
    return isHistory ? kind + 3 : kind;
  }
  static ceilingOf(tier, limit) {
    if (tier < 0) { return Infinity; }
    const ratio = CommentDisplayBudget.CEILING_RATIO[tier];
    return Math.max(1, Math.floor(limit * (ratio === undefined ? 0.7 : ratio)));
  }
  /**
   * 新しい候補だけを、表示開始前に採否決定する。既存の表示は一切変更しない。
   * @param {Array} candidates まだ表示も見送りもしていない候補
   * @param {{liveCount:number, limit:number, tierOf:function, order?:function}} options
   * @returns {{admitted:Array, suppressed:Array<{chat, tier:number, reason:string}>}}
   */
  static admit(candidates, {liveCount = 0, limit = CommentDisplayBudget.DEFAULT, tierOf, order, groupOf} = {}) {
    limit = CommentDisplayBudget.normalizeLimit(limit);
    const tiers = new Map();
    for (const chat of candidates) { tiers.set(chat, tierOf ? tierOf(chat) : CommentDisplayBudget.tierOf(chat)); }
    const byTime = order || ((a, b) => a.beginLeftTiming - b.beginLeftTiming);
    const sorted = candidates.slice().sort((a, b) => (tiers.get(a) - tiers.get(b)) || byTime(a, b));
    const units = [], groups = new Map();
    for (const chat of sorted) {
      const tier = tiers.get(chat);
      const key = tier < 0 || !groupOf ? null : groupOf(chat);
      let unit = key == null ? null : groups.get(key);
      if (!unit) {
        unit = {chats: [], tier}; units.push(unit);
        if (key != null) { groups.set(key, unit); }
      }
      unit.chats.push(chat);
      unit.tier = Math.max(unit.tier, tier);
    }
    units.sort((a,b) => a.tier-b.tier || byTime(a.chats[0],b.chats[0]));
    const admitted = [], suppressed = [];
    let live = liveCount;
    for (const unit of units) {
      const count = unit.chats.length, tier = unit.tier;
      if (tier < 0 || live + count <= CommentDisplayBudget.ceilingOf(tier, limit)) {
        admitted.push(...unit.chats);
        if (tier >= 0) { live += count; }
      } else {
        const reason = (count > 1 ? 'ca_group_' : '') + (live + count > limit ? 'limit' : 'reserve');
        for (const chat of unit.chats) { suppressed.push({chat, tier: tiers.get(chat), reason}); }
      }
    }
    return {admitted, suppressed, tiers};
  }
}
//===END===
export {CommentDisplayBudget};
