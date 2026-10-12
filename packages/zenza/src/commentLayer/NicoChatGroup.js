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
    const filter=this._nicoChatFilter;
    const cached=this._filteredMembersValid&&this._filteredRevision===(filter.compositeRevision||0);
    let changedHere=false;
    for(const chat of nicoChatArray){
      this._members.push(chat);chat.group=this;
      if(filter.addCompositeChat?.(chat)?.has(this))changedHere=true;
    }
    if(nicoChatArray.length&&(filter.removeNgMatchedUser||changedHere)){
      this.onChange(null);return;
    }
    const accepted=filter.applyFilter(nicoChatArray);
    if(cached&&this._filteredMembersValid)this._filteredMembers.push(...accepted);
    else this._filteredMembersValid=false;
    this._filteredRevision=filter.compositeRevision||0;
    if(accepted.length)this.emit('addChatArray',accepted);
  }
  addChat(nicoChat) {
    const filter=this._nicoChatFilter;
    const cached=this._filteredMembersValid&&this._filteredRevision===(filter.compositeRevision||0);
    this._members.push(nicoChat);nicoChat.group=this;
    const changed=filter.addCompositeChat?.(nicoChat);
    if(filter.removeNgMatchedUser){this.onChange(null);return;}
    if(changed?.has(this))return; // Retroactive change already notified this group.
    const accepted=filter.applyFilter([nicoChat]);
    if(cached&&this._filteredMembersValid){if(accepted.length)this._filteredMembers.push(nicoChat);}
    else this._filteredMembersValid=false;
    this._filteredRevision=filter.compositeRevision||0;
    if(accepted.length)this.emit('addChat',nicoChat);
  }
  _getChat(nicoChat) {
    return (chat) => chat.threadId === nicoChat.threadId && chat.fork === nicoChat.fork && chat.no === nicoChat.no
  }
  removeChat(nicoChat) {
    const getChat = this._getChat(nicoChat);
    const index = this._members.findIndex(getChat);
    if (index < 0) { return; }
    this._filteredMembersValid = false;
    const removed=this._members[index];
    const wasVisible=this._nicoChatFilter.isSafe(removed);
    this._members.splice(index,1);
    const changed=this._nicoChatFilter.removeCompositeChat?.(removed);
    nicoChat.group = this;

    // 投稿者まとめてNGでは、非表示コメントの削除でも同じ投稿者の既存コメントが復帰しうる。
    if (!changed?.has(this)&&(this._nicoChatFilter.removeNgMatchedUser||wasVisible)) {
      this.onChange(null);
    }
  }
  get type() {return this._type;}
  get members() {
    if (!this._filteredMembersValid||this._filteredRevision!==(this._nicoChatFilter.compositeRevision||0)) {
      const accepted=this._nicoChatFilter.applyFilter(this._members);
      // Empty/disabled filter paths may return their input array. Keep the
      // incremental display cache separate from the authoritative member list.
      this._filteredMembers=accepted===this._members?accepted.slice():accepted;
      this._filteredMembersValid = true;
      this._filteredRevision=this._nicoChatFilter.compositeRevision||0;
    }
    return this._filteredMembers;
  }
  get nonFilteredMembers() { return this._members; }
  onChange(e) {
    if(e?.chat&&!e.composite&&this._nicoChatFilter.updateCompositeChat?.(e.chat)?.has(this))return;
    console.log('NicoChatGroup.onChange: ', e);
    this._filteredMembers = [];
    this._filteredMembersValid = false;
    this.emit('change', {
      chat: e,
      group: this
    });
  }
  _onCompositeChange(){this.onChange({composite:true});}
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
