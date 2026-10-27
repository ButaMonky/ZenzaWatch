// @ts-expect-error Legacy import is relative to packages/zenza, not this typed mirror.
import {workerUtil} from '../../../lib/src/infra/workerUtil';

// const Config = ZenzaWatch.config;

// Task624: type-only comment slot-layout request and worker contract.
export interface SlotLayoutCommentContract {
  begin: number;
  end: number;
  no: number;
  fork: number;
  invisible?: boolean;
  slot?: number;
}
export interface SlotLayoutRequestContract {
  top: SlotLayoutCommentContract[];
  naka: SlotLayoutCommentContract[];
  bottom: SlotLayoutCommentContract[];
  lastUpdate: number;
}
export interface SlotLayoutResponseContract extends SlotLayoutRequestContract {}
export interface SlotLayoutWorkerRequestMessage {
  command: 'layout';
  params: SlotLayoutRequestContract;
}
export interface SlotLayoutWorkerScopeContract {
  onmessage?: (message: SlotLayoutWorkerRequestMessage) => SlotLayoutResponseContract;
}
export interface SlotLayoutRpcClientContract {
  post(message: SlotLayoutWorkerRequestMessage): Promise<SlotLayoutResponseContract>;
}
export interface SlotLayoutWorkerContract {
  readonly _func: (self: SlotLayoutWorkerScopeContract) => void;
  create(): SlotLayoutRpcClientContract | null;
}

//===BEGIN===

const SlotLayoutWorker: SlotLayoutWorkerContract = (() => {
  const func = function (self: SlotLayoutWorkerScopeContract) {

    // 暫定設置
    const SLOT_COUNT = 40;

    /**
     * スロット≒Z座標をよしなに割り当てる。
     * デザパタ的にいうならFlyweightパターンの亜種。
     * ゲームプログラミングではよくあるやつ。
     */
    class SlotEntry {
      declare slotCount: number;
      declare slot: number[];
      declare itemTable: Record<number, SlotLayoutCommentContract>;
      declare p: number;
      constructor(slotCount?: number) {
        this.slotCount = slotCount || SLOT_COUNT;
        this.slot = [];
        this.itemTable = {};
        this.p = 1;
      }
      findIdle(sec: number): number {
        const {slotCount, slot, itemTable} = this;
        for (let i = 0; i < slotCount; i++) {
          if (!slot[i]) {
            //console.log('empty found! idx=%s, sec=%s slot=%s', i, sec, JSON.stringify(slot));
            slot[i] = this.p++;
            return i;
          }

          let item = itemTable[i];
          if (sec < item.begin || sec > item.end) {
            //console.log('idle found! idx=%s, sec=%s ', i, sec, JSON.stringify(slot), JSON.stringify(item));
            slot[i] = this.p++;
            return i;
          }
        }
        return -1;
      }
      get mostOld(): number {
        let idx = 0, slot = this.slot, min = slot[0];
        for (let i = 1, len = this.slot.length; i < len; i++) {
          if (slot[i] < min) {
            min = slot[i];
            idx = i;
          }
        }
        return idx;
      }
      find(item: SlotLayoutCommentContract, sec: number): number {
        // まずは空いてるスロットを小さい順に探す
        let slot = this.findIdle(sec);
        // なかったら、一番古いやつから奪い取る
        if (slot < 0) {
          slot = this.mostOld;
          // Replaced entries must become newest, not remain oldest forever.
          this.slot[slot] = this.p++;
        }
        this.itemTable[slot] = item;
        return slot;
      }
    }

    const sortByBeginTime = (data: SlotLayoutCommentContract[]): SlotLayoutCommentContract[] => {
      data = data.concat().sort((a, b) => {
        const av = a.begin, bv = b.begin;
        if (av !== bv) {
          return av - bv;
        } else {
          return a.no < b.no ? -1 : 1;
        }
      });
      return data;
    };

    const execute = ({top, naka, bottom}: SlotLayoutRequestContract): Omit<SlotLayoutResponseContract, 'lastUpdate'> => {
      const data = sortByBeginTime([top, naka, bottom].flat());

      const slotEntries = [new SlotEntry(), new SlotEntry(), new SlotEntry()];

      for (let i = 0, len = data.length; i < len; i++) {
        const o = data[i];
        if (o.invisible) {
          continue;
        }
        const sec = o.begin;
        const fork = o.fork % 3;
        o.slot = slotEntries[fork].find(o, sec);
      }
      // Preserve each original vpos-sorted group for bulkSlotData setters.
      return {top, naka, bottom};
    };

    self.onmessage = ({command, params}) => {
      console.time('SlotLayoutWorker');

      const result = execute(params) as SlotLayoutResponseContract;

      console.timeEnd('SlotLayoutWorker');

      result.lastUpdate = params.lastUpdate;
      return result;
    };

  };

  return {
    _func: func,
    create: function () {
      if (!workerUtil.isAvailable) {
        return null;
      }
      return workerUtil.createCrossMessageWorker(func, {name: 'SlotLayoutWorker'});
    }
  };
})();


//===END===

export {
  SlotLayoutWorker
};
