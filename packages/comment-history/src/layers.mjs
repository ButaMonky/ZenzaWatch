import {validateThreads,integerOption,fail} from './core.mjs';

/** In-memory canonical comments, with independent normal/history memberships.
 * Snapshots contain comment data and are NOT diagnostic reports.
 * A normal entry wins over a historical version of the same comment.
 */
export class LayeredCommentStore {
  #context;
  #items=new Map();
  #normalMeta=new Map();
  #historyMeta=new Map();
  #normalCount=0;
  #historyCount=0;
  #overlapCount=0;
  // Task207: keys of history entries in the order they first became additional (= fetch order, nearest to the
  // normal comments first). Subsets for "applied additional count" are prefixes of this order, so they are stable.
  #additionalOrder=[];
  constructor(context){this.#context=context;}
  #threadKey(t){return JSON.stringify([t.id,t.fork]);}
  #key(t,c){return JSON.stringify([this.#context.videoId,this.#context.language,t.id,t.fork,c.no]);}
  #add(input,kind,allowance){
    integerOption(allowance,0,50000);
    if(!Array.isArray(input))fail('RESPONSE_SCHEMA');
    if(!input.length)return {added:0,duplicates:0,limited:false};
    const threads=validateThreads({meta:{status:200},data:{threads:input}},this.#context,input.map(t=>({id:t.id,fork:t.fork})));
    // Validate every identity before writing any item or thread metadata.
    const pageIds=new Map();
    for(const t of threads)for(const c of t.comments){
      const k=this.#key(t,c),old=this.#items.get(k);
      const id=old?.normal?.id??old?.history?.id??pageIds.get(k);
      if(id!==undefined && id!==c.id)fail('IDENTITY_CONFLICT');
      pageIds.set(k,c.id);
    }
    let added=0,duplicates=0,limited=false;
    for(const t of threads){
      const tk=this.#threadKey(t);
      const meta=kind==='normal'?this.#normalMeta:this.#historyMeta;
      // Do not allow old history's count field to change normal current metadata.
      meta.set(tk,{id:t.id,fork:t.fork,commentCount:t.commentCount});
      for(const c of t.comments){
        const k=this.#key(t,c),old=this.#items.get(k);
        const gains=kind==='history'?!old?.normal&&!old?.history:!old?.normal;
        if(gains && added>=allowance){limited=true;continue;}
        const entry=old??{thread:tk,normal:null,history:null};
        if(entry[kind])duplicates++;
        else {
          if(kind==='normal')this.#normalCount++;else this.#historyCount++;
          if(entry[kind==='normal'?'history':'normal'])this.#overlapCount++;
        }
        if(gains){added++;if(kind==='history')this.#additionalOrder.push(k);}
        entry[kind]=c;
        this.#items.set(k,entry);
      }
    }
    return {added,duplicates,limited};
  }
  addNormal(threads){return this.#add(threads,'normal',50000);}
  addHistory(threads,allowance=50000){return this.#add(threads,'history',allowance);}
  removeHistory(){
    for(const [key,entry] of this.#items){
      if(entry.normal)entry.history=null;else this.#items.delete(key);
    }
    this.#historyMeta.clear();this.#historyCount=0;this.#overlapCount=0;this.#additionalOrder=[];
  }
  /** Identity keys only (no comment data). Used to carry the fetch order into a continuation session. */
  additionalOrder(){return this.#additionalOrder.filter(k=>{const e=this.#items.get(k);return !!(e?.history&&!e.normal);});}
  /** Reorder restored history by a previous session's order; unknown keys are ignored, missing ones keep their order. */
  restoreAdditionalOrder(keys){
    if(!Array.isArray(keys))return;
    const current=new Set(this.#additionalOrder),seen=new Set(),out=[];
    for(const k of keys)if(typeof k==='string'&&current.has(k)&&!seen.has(k)){seen.add(k);out.push(k);}
    for(const k of this.#additionalOrder)if(!seen.has(k)){seen.add(k);out.push(k);}
    this.#additionalOrder=out;
  }
  historySnapshot(){
    const out=new Map([...this.#historyMeta].map(([k,t])=>[k,{...t,comments:[]}]));
    for(const entry of this.#items.values())if(entry.history){
      const c=entry.history;out.get(entry.thread).comments.push({...c,commands:[...c.commands]});
    }
    return [...out.values()];
  }
  counts(){
    return {normalCount:this.#normalCount,historyCount:this.#historyCount,overlapCount:this.#overlapCount,
      additionalCount:this.#historyCount-this.#overlapCount,unionCount:this.#items.size};
  }
  snapshot({historyEnabled=true,historyOnly=false,historyLimit}={}){
    const out=new Map();
    if(historyEnabled)for(const [k,t] of this.#historyMeta)out.set(k,{...t,comments:[]});
    for(const [k,t] of this.#normalMeta)out.set(k,{...t,comments:[]});
    // Task207: limit additional history to the first N of the fetch order (undefined = all).
    let allowed=null;
    if(historyLimit!==undefined){integerOption(historyLimit,0,50000);allowed=new Set(this.additionalOrder().slice(0,historyLimit));}
    for(const [key,entry] of this.#items){
      const history=entry.history&&(!allowed||entry.normal||allowed.has(key))?entry.history:null;
      const c=historyOnly?(entry.normal?null:history):(entry.normal??(historyEnabled?history:null));
      if(c)out.get(entry.thread).comments.push({...c,commands:[...c.commands]});
    }
    for(const t of out.values())t.comments.sort((a,b)=>a.no-b.no);
    return [...out.values()];
  }
}
