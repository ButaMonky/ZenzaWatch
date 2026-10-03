const identity=chat=>JSON.stringify([String(chat.threadId??chat.thread),Number(chat.fork),Number(chat.no)]);
const abortError=()=>Object.assign(new Error('Comment display update superseded'),{name:'AbortError'});

/** Prepares detached layout data; it never resets the normal comment or NicoScript session. */
export class CommentHistoryRenderer {
  #player;#Chat;#VM;#yield;#revision=0;#history=new Set();#deleted=new Set();
  // Task207: display objects of history comments that a smaller applied count took off the screen. Kept (same
  // video only) so that raising the count again reuses the very same objects (identity, nicoru state) instead of
  // re-creating them. Released with the cache by reset() (video switch / reload) and clear() (OFF).
  #retained=new Map();
  constructor({player,Chat,ChatViewModel,yieldControl=()=>new Promise(r=>setTimeout(r,0))}){
    this.#player=player;this.#Chat=Chat;this.#VM=ChatViewModel;this.#yield=yieldControl;
  }
  #groups(){const m=this.#player._model;return [m.topGroup,m.nakaGroup,m.bottomGroup];}
  reset(){this.#revision++;this.#history.clear();this.#deleted.clear();this.#retained.clear();}
  removed(chat){this.#deleted.add(identity(chat));this.#history.delete(chat);this.#retained.delete(identity(chat));this.#revision++;}
  /** Diagnostics for tests: number of retained (currently not applied) display objects. */
  get retainedCount(){return this.#retained.size;}
  /** Read-only: whether this display object came from the added history (used for display priority only). */
  has(chat){return !!chat&&this.#history.has(chat);}
  clear(){
    this.#revision++;this.#retained.clear();
    if(!this.#history.size)return;
    for(const group of this.#groups()){
      if(!group)continue;
      group._members=group._members.filter(chat=>!this.#history.has(chat));
      group._filteredMembers=[];group._filteredMembersValid=false;
      group.onChange(null);
    }
    this.#history.clear();this.#player._view?.refresh();this.#player._model.emit('change');
  }
  async apply(data,{isCurrent=()=>true,signal}={}){
    const revision=++this.#revision,model=this.#player._model;
    const valid=()=>revision===this.#revision&&!signal?.aborted&&isCurrent();
    const check=()=>{if(!valid())throw abortError();};
    check();await model.promise('GetReady!');check();
    if(!data||!Array.isArray(data.threads))throw new TypeError('Invalid history display input');
    const count=data.threads.reduce((n,t)=>n+(Array.isArray(t.comments)?t.comments.length:Infinity),0);
    if(count>20000)throw new RangeError('History display limit is 20000');
    const types=[this.#Chat.TYPE.TOP,this.#Chat.TYPE.NAKA,this.#Chat.TYPE.BOTTOM];
    const oldByKey=new Map([...this.#retained.values(),...this.#history].map(c=>[identity(c),c]));
    const options=model._options||{};
    const added=[],newChats=[],seen=new Set();
    for(const thread of data.threads){
      if(!thread.info||![0,2].includes(thread.info.fork)&&thread.comments.length)throw new TypeError('Unsupported history fork');
      for(const c of thread.comments){
        const key=identity({thread:thread.id,fork:thread.info.fork,no:c.no});
        if(seen.has(key)||this.#deleted.has(key))continue;
        seen.add(key);
        let chat=oldByKey.get(key);
        if(!chat){
          chat=this.#Chat.create(Object.assign({},c,{
            text:c.body,date:new Date(c.postedAt).getTime()/1000,cmd:c.commands.join(' '),
            premium:c.isPremium,user_id:c.userId,vpos:c.vposMs/10,fork:thread.info.fork,
            isMine:c.isMyPost,thread:thread.id,nicoru:c.nicoruCount,
            layerId:thread.info.layer.index,threadLabel:thread.info.label
          }),{videoDuration:options.duration,creditDuration:options.creditDuration,mainThreadId:options.mainThreadId});
          if(chat.isDeleted||chat.isNicoScript)continue;
          if(chat.fork===2)chat.size=this.#Chat.SIZE.SMALL;
          if(model._wordReplacer)chat.text=model._wordReplacer(chat.text);
          newChats.push(chat);
        }
        added.push(chat);
        if(added.length%100===0){await this.#yield();check();}
      }
    }
    // Existing script registrations/runtime remain intact; only new display objects are transformed.
    if(newChats.length&&!model.nicoScripter.isEmpty)model.nicoScripter.apply(newChats);
    check();
    const prepared=[];
    try{
      for(let attempt=0;attempt<3;attempt++){
        prepared.splice(0).forEach(x=>x.members.forEach(m=>m.reset()));
        const groups=this.#groups(),vms=types.map(t=>this.#player._viewModel.getGroup(t));
        if(groups.some(g=>!g)||vms.some(g=>!g))throw new Error('Comment view is not ready');
        const sources=groups.map(g=>({array:g._members,length:g._members.length}));
        const versions=vms.map(v=>v._lastUpdate);
        const normals=groups.flatMap(g=>g._members.filter(c=>!this.#history.has(c)));
        const normalKeys=new Set(normals.map(identity));
        const extras=added.filter(c=>!normalKeys.has(identity(c))&&!this.#deleted.has(identity(c)));
        const all=normals.concat(extras);
        for(let i=0;i<groups.length;i++){
          check();
          const chats=all.filter(c=>c.type===types[i]||(i===1&&!types.includes(c.type)));
          const filtered=model._nicoChatFilter.applyFilter(chats),members=[];
          // Keep the candidate owned by prepared during every await so failures release it too.
          const entry={chats,filtered,members,group:groups[i],vm:vms[i],sorted:[],maxDuration:0};prepared.push(entry);
          for(const c of filtered){
            members.push(this.#VM.create(c,vms[i]._offScreen));
            if(members.length%100===0){await this.#yield();check();}
          }
          this.#VM.prepareCommentArt?.(members);
          const sorted=entry.sorted=members.slice().sort(this.#Chat.SORT_FUNCTION);
          if(sorted.length){
            const sent=sorted.map(c=>c.bulkLayoutData);
            const result=await this.#wait(vms[i]._layoutWorker.post({command:'layout',params:{type:types[i],members:sent,lastUpdate:revision}}),signal);
            check();
            if(result?.lastUpdate!==revision||!Array.isArray(result.members)||result.members.length!==sent.length||
              !sent.every((m,j)=>result.members[j]?.id===m.id&&Number.isFinite(result.members[j].ypos)&&typeof result.members[j].isOverflow==='boolean'))throw new Error('Invalid history layout response');
            sorted.forEach((m,j)=>{m.bulkLayoutData=result.members[j];});
            for(const m of sorted){const d=m.endRightTiming-m.beginLeftTiming;if(Number.isFinite(d)&&d>entry.maxDuration)entry.maxDuration=d;}
          }
        }
        check();
        if(groups.some((g,i)=>g._members!==sources[i].array||g._members.length!==sources[i].length||vms[i]._lastUpdate!==versions[i]))continue;
        // Single synchronous commit: the old screen survives until every group has a valid reply.
        this.#player._view?.clear?.();
        for(const e of prepared){
          for(const c of e.chats)c.group=e.group;
          e.group._members=e.chats;e.group._filteredMembers=e.filtered;e.group._filteredMembersValid=true;
          const old=e.vm._members;
          e.vm._lastUpdate++;e.vm._members=e.members;e.vm._vSortedMembers=e.sorted;e.vm._maxInViewDuration=e.maxDuration;
          for(const m of old)m.reset();
        }
        const next=new Set(extras);
        for(const c of this.#history)if(!next.has(c))this.#retained.set(identity(c),c);
        for(const c of extras)this.#retained.delete(identity(c));
        this.#history=next;
        prepared.length=0;
        this.#player._view?.refresh();model.emit('change');
        return {additionalCount:extras.length};
      }
      throw new Error('Comment collection changed during display preparation');
    }finally{prepared.forEach(e=>e.members.forEach(m=>m.reset()));}
  }
  #wait(promise,signal){
    return new Promise((resolve,reject)=>{
      const finish=(fn,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn(value);};
      const cancel=()=>finish(reject,abortError());
      const timer=setTimeout(()=>finish(reject,new Error('Comment layout timed out')),20000);
      signal?.addEventListener('abort',cancel,{once:true});
      Promise.resolve(promise).then(v=>finish(resolve,v),e=>finish(reject,e));
      if(signal?.aborted)cancel();
    });
  }
}
