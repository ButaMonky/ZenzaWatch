import {Emitter} from '../../../lib/src/Emitter';
import {NicoChatFilter} from './NicoChatFilter';

//===BEGIN===
class NicoChatGroup extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
  initialize(type, params) {
    this._type = type;

    this._nicoChatFilter = params.nicoChatFilter;
    this._nicoChatFilter.on('change', this._onFilterChange.bind(this));

    this.reset();
  }
  reset() {
    this._members = [];
    this._filteredMembers = [];
    this._filteredMembersValid = false;
  }
  addChatArray(nicoChatArray) {
    this._filteredMembersValid = false;
    let members = this._members;
    let newMembers = [];
    for (const nicoChat of nicoChatArray) {
      newMembers.push(nicoChat);
      members.push(nicoChat);
      nicoChat.group = this;
    }

    if (nicoChatArray.length && this._nicoChatFilter.removeNgMatchedUser) {
      this.onChange(null);
      return;
    }
    newMembers = this._nicoChatFilter.applyFilter(nicoChatArray);
    if (newMembers.length > 0) {
      this.emit('addChatArray', newMembers);
    }
  }
  addChat(nicoChat) {
    this._filteredMembersValid = false;
    this._members.push(nicoChat);
    nicoChat.group = this;

    // 投稿者まとめてNGでは、追加分が同じ投稿者の既存コメントも隠しうるため全体を通知する。
    if (this._nicoChatFilter.removeNgMatchedUser) {
      this.onChange(null);
      return;
    }
    if (this._nicoChatFilter.isSafe(nicoChat)) {
      this.emit('addChat', nicoChat);
    }
  }
  _getChat(nicoChat) {
    return (chat) => chat.threadId === nicoChat.threadId && chat.fork === nicoChat.fork && chat.no === nicoChat.no
  }
  removeChat(nicoChat) {
    const getChat = this._getChat(nicoChat);
    const index = this._members.findIndex(getChat);
    if (index < 0) { return; }
    this._filteredMembersValid = false;
    this._members.splice(index, 1);
    nicoChat.group = this;

    // 投稿者まとめてNGでは、非表示コメントの削除でも同じ投稿者の既存コメントが復帰しうる。
    if (this._nicoChatFilter.removeNgMatchedUser || this._nicoChatFilter.isSafe(nicoChat)) {
      this.onChange(null);
    }
  }
  get type() {return this._type;}
  get members() {
    if (!this._filteredMembersValid) {
      this._filteredMembers = this._nicoChatFilter.applyFilter(this._members);
      this._filteredMembersValid = true;
    }
    return this._filteredMembers;
  }
  get nonFilteredMembers() { return this._members; }
  onChange(e) {
    console.log('NicoChatGroup.onChange: ', e);
    this._filteredMembers = [];
    this._filteredMembersValid = false;
    this.emit('change', {
      chat: e,
      group: this
    });
  }
  _onFilterChange() {
    this._filteredMembers = [];
    this.onChange(null);
  }
  get currentTime() {return this._currentTime;}
  set currentTime(sec) {
    this._currentTime = sec;
    // let m = this._members;
    // for (let i = 0, len = m.length; i < len; i++) {
    //   m[i].currentTime = sec;
    // }
  }
  setSharedNgLevel(level) {
    if (NicoChatFilter.SHARED_NG_LEVEL[level] && this._sharedNgLevel !== level) {
      this._sharedNgLevel = level;
      this.onChange(null);
    }
  }
  includes(nicoChat) {
    const uno = nicoChat.uniqNo;
    return this._members.find(m => m.uniqNo === uno);
  }
}

//===END===

export {NicoChatGroup};
