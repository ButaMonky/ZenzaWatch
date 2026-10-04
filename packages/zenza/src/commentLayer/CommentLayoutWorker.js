import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';
import {workerUtil} from '../../../lib/src/infra/workerUtil';

const Config = ZenzaWatch.config;

//===BEGIN===

const CommentLayoutWorker = (config => {
  const func = function(self) {

    // 暫定設置
    const TYPE = {
      TOP: 'ue',
      NAKA: 'naka',
      BOTTOM: 'shita'
    };

    const SCREEN = {
      WIDTH_INNER: 512,
      WIDTH_FULL_INNER: 640,
      WIDTH: 512 + 32,
      WIDTH_FULL: 640 + 32,
      HEIGHT: 384
    };


    const isTemporalConflict = (target, others) => {
      // ターゲットと自分、どっちが右でどっちが左か？の判定
      let rt, lt;
      if (target.beginLeft <= others.beginLeft) {
        lt = target;
        rt = others;
      } else {
        lt = others;
        rt = target;
      }

      if (target.isFixed) {

        // 左にあるやつの終了より右にあるやつの開始が早いなら、衝突する
        // > か >= で挙動が変わるCAがあったりして正解がわからない
        if (lt.endRight > rt.beginLeft) {
          return true;
        }

      } else {

        // 左にあるやつの右端開始よりも右にあるやつの左端開始のほうが早いなら、衝突する
        if (lt.beginRight >= rt.beginLeft) {
          return true;
        }

        // 左にあるやつの右端終了よりも右にあるやつの左端終了のほうが早いなら、衝突する
        if (lt.endRight >= rt.endLeft) {
          return true;
        }

      }

      return false;
    };

    const isConflict = (target, others) => {
      // 一度はみ出した文字は当たり判定を持たない
      if (target.isOverflow || others.isOverflow || others.isInvisible) {
        return false;
      }

      if (target.layerId !== others.layerId) {
        return false;
      }

      // Y座標が合わないなら絶対衝突しない
      const othersY = others.ypos;
      const targetY = target.ypos;
      if (othersY + others.height < targetY ||
        othersY > targetY + target.height) {
        return false;
      }

      // ターゲットと自分、どっちが右でどっちが左か？の判定
      let rt, lt;
      if (target.beginLeft <= others.beginLeft) {
        lt = target;
        rt = others;
      } else {
        lt = others;
        rt = target;
      }

      if (target.isFixed) {

        // 左にあるやつの終了より右にあるやつの開始が早いなら、衝突する
        // > か >= で挙動が変わるCAがあったりして正解がわからない
        if (lt.endRight > rt.beginLeft) {
          return true;
        }

      } else {

        // 左にあるやつの右端開始よりも右にあるやつの左端開始のほうが早いなら、衝突する
        if (lt.beginRight >= rt.beginLeft) {
          return true;
        }

        // 左にあるやつの右端終了よりも右にあるやつの左端終了のほうが早いなら、衝突する
        if (lt.endRight >= rt.endLeft) {
          return true;
        }

      }

      return false;
    };

    const moveToNextLine = (self, others) => {
      const margin = 1;
      const othersHeight = others.height + margin;
      // 本来はちょっとでもオーバーしたらランダムすべきだが、
      // 本家とまったく同じサイズ計算は難しいのでマージンを入れる
      // コメントアートの再現という点では有効な妥協案
      const overflowMargin = 10;
      const rnd = Math.max(0, SCREEN.HEIGHT - self.height);
      const yMax = SCREEN.HEIGHT - self.height + overflowMargin;
      const yMin = 0 - overflowMargin;

      const type = self.type;
      let ypos = self.ypos;

      if (type !== TYPE.BOTTOM) {
        ypos += othersHeight;
        // 画面内に入りきらなかったらランダム配置
        if (ypos > yMax) {
          self.isOverflow = true;
        }
      } else {
        ypos -= othersHeight;
        // 画面内に入りきらなかったらランダム配置
        if (ypos < yMin) {
          self.isOverflow = true;
        }
      }

      self.ypos = self.isOverflow ? Math.floor(Math.random() * rnd) : ypos;

      return self;
    };


    /**
     * 各位置までの endRight の最大値と、同一IDの最初の位置を1回だけ作る。
     * endRight が不正なら安全側（スキップしない）に倒す。
     */
    const createCollisionIndex = members => {
      const maxEnd = new Array(members.length);
      const firstId = new Map();
      let end = -Infinity;
      for (let i = 0, len = members.length; i < len; i++) {
        const o = members[i];
        const value = o.endRight;
        end = Math.max(end, Number.isFinite(value) ? value : Infinity);
        maxEnd[i] = end;
        // Map は NaN を同一視するが、元実装の === は NaN を同一視しない。
        if (o.id === o.id && !firstId.has(o.id)) {
          firstId.set(o.id, i);
        }
      }
      return {maxEnd, firstId, candidates: [], tops: [], bottoms: []};
    };

    /**
     * 最初に衝突が起こりうるindexを返す。
     * prefix max を二分探索し、targetより前で絶対に時間が重ならない範囲だけを飛ばす。
     */
    const findCollisionStartIndex = (target, members, index) => {
      const tl = target.beginLeft;
      const tr = target.endRight;
      const layerId = target.layerId;
      const stop = index.firstId.has(target.id) ?
        index.firstId.get(target.id) : members.length;
      let low = 0, high = stop;
      if (Number.isFinite(tl)) {
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (index.maxEnd[mid] < tl) {
            low = mid + 1;
          } else {
            high = mid;
          }
        }
      }

      for (let i = low; i < stop; i++) {
        const o = members[i];
        const ol = o.beginLeft;
        const or = o.endRight;

        if (layerId !== o.layerId || o.invisible || o.isOverflow) {
          continue;
        }

        if (tl <= or && tr >= ol) {
          return i;
        }
      }

      return -1;
    };

    const _checkCollision = (target, members, collisionStartIndex) => {
      const beginLeft = target.beginLeft;
      for (let i = collisionStartIndex, len = members.length; i < len; i++) {
        const o = members[i];

        // 自分よりうしろのメンバーには影響を受けないので処理不要
        if (o.id === target.id) {
          return target;
        }

        if (beginLeft > o.endRight) {
          continue;
        }

        if (isConflict(target, o)) {
          target = moveToNextLine(target, o);

          // ずらした後は再度全チェックするのを忘れずに(再帰)
          if (!target.isOverflow) {
            return _checkCollision(target, members, collisionStartIndex);
          }
        }
      }
      return target;
    };

    // During one target's placement, preceding comments and all time/layer predicates
    // are immutable. Compact once, then preserve the exact first-conflict order at
    // every vertical move. Scratch storage belongs to this request, never the worker.
    const checkDenseCollision = (target, members, start, stop, index) => {
      const {candidates, tops, bottoms} = index;
      candidates.length = tops.length = bottoms.length = 0;
      for (let i = start; i < stop; i++) {
        const other = members[i];
        if (other.isOverflow || other.isInvisible || target.layerId !== other.layerId ||
            target.beginLeft > other.endRight || !isTemporalConflict(target, other)) { continue; }
        if (!Number.isFinite(other.ypos) || !Number.isFinite(other.height) || other.height < 0) {
          candidates.length = tops.length = bottoms.length = 0;
          return _checkCollision(target, members, start);
        }
        candidates.push(other);
        tops.push(other.ypos);
        bottoms.push(other.ypos + other.height);
      }
      while (!target.isOverflow) {
        let moved = false;
        const top = target.ypos, bottom = top + target.height;
        for (let i = 0; i < candidates.length; i++) {
          if (bottoms[i] < top || tops[i] > bottom) { continue; }
          moveToNextLine(target, candidates[i]);
          moved = true;
          break;
        }
        if (!moved) { break; }
      }
      candidates.length = tops.length = bottoms.length = 0;
      return target;
    };

    const checkCollision = (target, members, index) => {
      if (target.isInvisible || target.isOverflow) {
        return target;
      }

      const collisionStartIndex = findCollisionStartIndex(target, members, index);

      if (collisionStartIndex < 0) {
        return target;
      }

      const stop = index.firstId.get(target.id);
      // Fixed-comment compaction measured slower; keep its original scan path.
      // Also preserve small groups, NaN IDs, and malformed geometry unchanged.
      if (!target.isFixed && Number.isInteger(stop) && stop - collisionStartIndex >= 32 &&
          Number.isFinite(target.ypos) && Number.isFinite(target.height) && target.height >= 0) {
        return checkDenseCollision(target, members, collisionStartIndex, stop, index);
      }
      return _checkCollision(target, members, collisionStartIndex);
    };


    const groupCollision = members => {
      const index = createCollisionIndex(members);
      for (let i = 0, len = members.length; i < len; i++) {
        //members[i] =
        checkCollision(members[i], members, index);
      }
      return members;
    };

    self.onmessage = ({command, params}) => {
      const {type, members, lastUpdate} = params;
      console.time('CommentLayoutWorker: ' + type);
      groupCollision(members);
      console.timeEnd('CommentLayoutWorker: ' + type);
      return {type, members, lastUpdate};
    };

  };

  let instance = null;
  return {
    _func: func,
    create: () => workerUtil.createCrossMessageWorker(func, {name: 'CommentLayoutWorker'}),
    getInstance() {
      if (!instance) {
        instance = this.create();
      }
      return instance;
    }
  };
})(Config);

//===END===


export {
  CommentLayoutWorker
};


// /**
//  * findCollisionStartIndexの効率化を適用する前の物
//  */
// let checkCollision_old = function (target, members) {
//   if (target.isInvisible) {
//     return target;
//   }
//
//   let o;
//   let beginLeft = target.beginLeft;
//   for (let i = 0, len = members.length; i < len; i++) {
//     o = members[i];
//
//     // 自分よりうしろのメンバーには影響を受けないので処理不要
//     if (o.id === target.id) {
//       return target;
//     }
//
//     if (beginLeft > o.endRight) {
//       continue;
//     }
//
//
//     if (isConflict(target, o)) {
//       target = moveToNextLine(target, o);
//
//       // ずらした後は再度全チェックするのを忘れずに(再帰)
//       if (!target.isOverflow) {
//         return checkCollision(target, members);
//       }
//     }
//   }
//   return target;
// };
