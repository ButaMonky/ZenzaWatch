// @ts-expect-error Stage A mirror keeps the runtime-relative import path.
import {NicoChatViewModel} from './NicoChatViewModel';
// @ts-expect-error Stage A mirror keeps the runtime-relative import path.
import {CommentLayoutWorker} from './CommentLayoutWorker';
// @ts-expect-error Stage A mirror keeps the runtime-relative import path.
import {NicoChat} from './NicoChat';

// Task592: typed interface for existing comment-layer behavior.
export interface NicoChatGroupViewModelContract {
  readonly type: unknown;
  readonly members: readonly unknown[];
  currentTime: number;
  bulkLayoutData: unknown;
}
export interface NicoChatGroupLayoutDatum {
  id: unknown;
  ypos: number;
  isOverflow: boolean;
  [property: string]: unknown;
}
export interface NicoChatGroupSlotDatum {
  id: unknown;
  slot: number;
  fork: number;
  no: number;
  vpos: number;
  begin: number;
  end: number;
  invisible: boolean;
}
interface NicoChatGroupMember {
  id: unknown;
  type: string;
  _commentArtMetadata: unknown;
  _y: number;
  _isOverflow: boolean;
  _isLayouted: boolean;
  isLayouted: boolean;
  isInvisible: boolean;
  isOverflow: boolean;
  beginLeftTiming: number;
  endRightTiming: number;
  inviewTiming: number;
  vpos: number;
  no: number;
  fork: number;
  slot: number;
  bulkLayoutData: NicoChatGroupLayoutDatum;
  reset(): void;
  resetLayoutForSpeedChange(): void;
  recalcBeginEndTiming(rate: number): void;
  moveToNextLine(other: NicoChatGroupMember): void;
  checkCollision(other: NicoChatGroupMember): boolean;
  isInViewBySecond(sec: number): boolean;
  export(): string;
}
interface NicoChatGroupSourceChat {
  text: string;
  [property: string]: unknown;
}
interface NicoChatGroupSource {
  on(event: 'addChatArray', listener: (chats: readonly NicoChatGroupSourceChat[]) => void): unknown;
  on(event: 'addChat', listener: (chat: NicoChatGroupSourceChat) => void): unknown;
  on(event: 'reset', listener: () => void): unknown;
  on(event: 'change', listener: (event: unknown) => void): unknown;
  readonly members: readonly NicoChatGroupSourceChat[];
  readonly currentTime: number;
  readonly type: string;
}
interface NicoChatGroupLayoutReply {
  lastUpdate: number;
  members: NicoChatGroupLayoutDatum[];
}
//===BEGIN===
class NicoChatGroupViewModel {
  declare _currentTime: number | undefined;
  declare _nicoChatGroup: NicoChatGroupSource;
  declare _offScreen: unknown;
  declare _members: NicoChatGroupMember[];
  declare _vSortedMembers: NicoChatGroupMember[];
  declare _lastUpdate: number;
  declare _maxInViewDuration: number;
  declare _layoutWorker: {post(message: {command: 'layout'; params: {type: string; members: NicoChatGroupLayoutDatum[]; lastUpdate: number}}): Promise<NicoChatGroupLayoutReply>};
  declare _hasLayout: boolean | undefined;
  declare _layout: () => void;
  constructor(...args: [NicoChatGroupSource, unknown]) {
    this.initialize(...args);
  }
  initialize(nicoChatGroup: NicoChatGroupSource, offScreen: unknown) {
    this._nicoChatGroup = nicoChatGroup;
    this._offScreen = offScreen;
    this._members = [];
    this._lastUpdate = 0;

    // メンバーをvposでソートした物. 計算効率改善用
    this._vSortedMembers = [];
    this._maxInViewDuration = 0;

    this._initWorker();

    nicoChatGroup.on('addChat', this._onAddChat.bind(this));
    nicoChatGroup.on('addChatArray', this._onAddChatArray.bind(this));
    nicoChatGroup.on('reset', this._onReset.bind(this));
    nicoChatGroup.on('change', this._onChange.bind(this));
    NicoChatViewModel.emitter.on('updateBaseChatScale', this._onChange.bind(this));
    NicoChatViewModel.emitter.on('updateCommentSpeedRate', this._onCommentSpeedRateUpdate.bind(this));

    this.addChatArray(nicoChatGroup.members);
  }
  _initWorker() {
    this._layoutWorker = CommentLayoutWorker.getInstance();
  }
  _onAddChatArray(nicoChatArray: readonly NicoChatGroupSourceChat[]) {
    this.addChatArray(nicoChatArray);
  }
  _onAddChat(nicoChat: NicoChatGroupSourceChat) {
    this.addChat(nicoChat);
  }
  _onReset() {
    this.reset();
  }
  _onChange(e: unknown) {
    console.log('NicoChatGroupViewModel.onChange: ', e);
    window.console.time('_onChange');
    this.reset();
    this.addChatArray(this._nicoChatGroup.members);
    window.console.timeEnd('_onChange');
  }
  async _execCommentLayoutWorker() {
    const requestId = ++this._lastUpdate;
    if (this._members.length < 1) { return true; }
    const type = this._members[0].type;
    const sourceMembers = this._members;
    const previous = sourceMembers.map(member => ({member, metadata: member._commentArtMetadata, y: member._y, overflow: member._isOverflow, ready: member._isLayouted}));
    NicoChatViewModel.prepareCommentArt(this._members);
    const data = this.bulkLayoutData;
    const members = this._vSortedMembers;
    try {
      const result = await this._layoutWorker.post({
        command: 'layout',
        params: {type, members: data, lastUpdate: requestId}
      });
      if (requestId !== this._lastUpdate || result.lastUpdate !== requestId) { return false; }
      // Validate the complete reply before writing any member (no partial layout).
      if (!Array.isArray(result.members) || result.members.length !== members.length ||
          !data.every((expected, i) => {
            const item = result.members[i];
            return item && item.id === expected.id && Number.isFinite(item.ypos) &&
              typeof item.isOverflow === 'boolean';
          })) {
        throw new Error('Invalid comment layout reply');
      }
      // Apply to the exact order sent to the worker, not a later sorted array.
      for (let i = 0; i < members.length; i++) {
        members[i].bulkLayoutData = result.members[i];
      }
      return true;
    } catch (err) {
      if (requestId === this._lastUpdate && this._members === sourceMembers) {
        for (const old of previous) {
          old.member._commentArtMetadata = old.metadata;
          old.member._y = old.y; old.member._isOverflow = old.overflow; old.member._isLayouted = old.ready;
        }
        console.warn('comment layout failed', err);
      }
      return false;
    }
  }
  async addChatArray(nicoChatArray: readonly NicoChatGroupSourceChat[]) {
    const members = this._members;
    for (let i = 0, len = nicoChatArray.length; i < len; i++) {
      if (members !== this._members) { return; }
      const nicoChat = nicoChatArray[i];
      const nc = NicoChatViewModel.create(nicoChat, this._offScreen);
      members.push(nc);
      ++this._lastUpdate;
      if (i % 100 === 99) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    if (members !== this._members || members.length < 1) { return; }
    this._execCommentLayoutWorker();
  }
  _onCommentSpeedRateUpdate() {
    this.changeSpeed(NicoChatViewModel.SPEED_RATE);
  }
  changeSpeed(speedRate = 1) {
    for (const member of this._members) {
      member.resetLayoutForSpeedChange();
      member.recalcBeginEndTiming(speedRate);
    }
    this._execCommentLayoutWorker();
  }
  _groupCollision() {
    this._createVSortedMembers();
    let members = this._vSortedMembers;
    for (let i = 0, len = members.length; i < len; i++) {
      let o = members[i];
      this.checkCollision(o);
      o.isLayouted = true;
    }
  }
  addChat(nicoChat: NicoChatGroupSourceChat) {
    let timeKey = 'addChat:' + nicoChat.text;
    window.console.time(timeKey);
    let nc = NicoChatViewModel.create(nicoChat, this._offScreen);

    ++this._lastUpdate;

    // 内部処理効率化の都合上、
    // 自身を追加する前に判定を行っておくこと
    this.checkCollision(nc);
    nc.isLayouted =true;

    this._members.push(nc);

    this._execCommentLayoutWorker();
    window.console.timeEnd(timeKey);
  }
  reset() {
    let m = this._members;
    for (let i = 0, len = m.length; i < len; i++) {
      m[i].reset();
    }

    this._members = [];
    this._vSortedMembers = [];
    this._maxInViewDuration = 0;
    ++this._lastUpdate;
  }
  get currentTime() {return this._nicoChatGroup.currentTime;}
  get type() {return this._nicoChatGroup.type;}
  checkCollision(target: NicoChatGroupMember) {
    if (target.isInvisible) {
      return;
    }

    const m = this._vSortedMembers;
    const beginLeft = target.beginLeftTiming;
    for (let i = 0, len = m.length; i < len; i++) {
      const o = m[i];

      // 自分よりうしろのメンバーには影響を受けないので処理不要
      if (o === target) {
        return;
      }

      if (beginLeft > o.endRightTiming) {
        continue;
      }

      if (o.checkCollision(target)) {
        target.moveToNextLine(o);

        // ずらした後は再度全チェックするのを忘れずに(再帰)
        if (!target.isOverflow) {
          this.checkCollision(target);
          return;
        }
      }
    }
  }
  get bulkLayoutData() {
    this._createVSortedMembers();
    const m = this._vSortedMembers;
    const result = [];
    for (let i = 0, len = m.length; i < len; i++) {
      result.push(m[i].bulkLayoutData);
    }
    return result;
  }
  set bulkLayoutData(data: NicoChatGroupLayoutDatum[]) {
    const m = this._vSortedMembers;
    for (let i = 0, len = m.length; i < len; i++) {
      m[i].bulkLayoutData = data[i];
    }
  }
  get bulkSlotData() {
    this._createVSortedMembers();
    let m = this._vSortedMembers;
    let result = [];
    for (let i = 0, len = m.length; i < len; i++) {
      let o = m[i];
      result.push({
        id: o.id,
        slot: o.slot,
        fork: o.fork,
        no: o.no,
        vpos: o.vpos,
        begin: o.inviewTiming,
        end: o.endRightTiming,
        invisible: o.isInvisible
      });
    }
    return result;
  }
  set bulkSlotData(data: NicoChatGroupSlotDatum[]) {
    let m = this._vSortedMembers;
    for (let i = 0, len = m.length; i < len; i++) {
      m[i].slot = data[i].slot;
    }
  }
  /**
   * vposでソートされたメンバーを生成. 計算効率改善用
   */
  _createVSortedMembers() {
    const members =
      this._vSortedMembers =
        this._members.concat().sort(NicoChat.SORT_FUNCTION);

    let maxDuration = 0;
    for (const member of members) {
      const duration = member.endRightTiming - member.beginLeftTiming;
      if (Number.isFinite(duration) && duration > maxDuration) {
        maxDuration = duration;
      }
    }
    this._maxInViewDuration = maxDuration;

    return members;
  }

  _findInViewStartIndex(sec: number) {
    const members = this._vSortedMembers;
    const minBegin = sec - (this._maxInViewDuration || 0);
    let low = 0;
    let high = members.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (members[mid].beginLeftTiming < minBegin) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  get members() {return this._members;}

  /**
   * 現時点で表示状態のメンバーのみを返す
   */
  get inViewMembers() {return this.getInViewMembersBySecond(this.currentTime);}
  // getMembers() {return this._members;}
  // getInViewMembers() {return this.inViewMembers;}

  /**
   * secの時点で表示状態のメンバーのみを返す
   */
  getInViewMembersBySecond(sec: number) {
    const result = [];
    const members = this._vSortedMembers;
    const len = members.length;
    const futureLimit = sec + 1;
    const startIndex = this._findInViewStartIndex(sec);

    for (let i = startIndex; i < len; i++) {
      const chat = members[i];
      if (chat.beginLeftTiming > futureLimit) {
        break;
      }
      if (chat.isInViewBySecond(sec)) {
        result.push(chat);
      }
    }
    return result;
  }
  getInViewMembersByVpos(vpos: number) {
    if (!this._hasLayout) {
      this._layout();
    }
    return this.getInViewMembersBySecond(vpos / 100);
  }
  export() {
    let result = [], m = this._members, len = m.length;

    result.push(['\t<group ',
      'type="', this._nicoChatGroup.type, '" ',
      'length="', m.length, '" ',
      '>'
    ].join(''));

    for (let i = 0; i < len; i++) {
      result.push(m[i].export());
    }

    result.push('\t</group>');
    return result.join('\n');
  }
  getCurrentTime() {return this.currentTime;}
  getType() {return this.type;}
}
//===END===
export {NicoChatGroupViewModel};
