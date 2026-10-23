import type {SearchOptions, SearchHit, SearchState} from "./SceneRuntimeContracts";
export class SceneCommentSearch {

 declare private _getChats:NonNullable<SearchOptions['getChats']>;declare private _getVideoId:NonNullable<SearchOptions['getVideoId']>;
 declare private _seekTo:NonNullable<SearchOptions['seekTo']>;declare private _onResults:SearchOptions['onResults']|null;
 declare private _limit:number;declare private _videoId:string|null;declare private _hits:SearchHit[];declare private _query:string;declare private _total:number;declare private _disposed:boolean;

  constructor({getChats,getVideoId,seekTo,onResults,limit=100}:SearchOptions={}) {
    if(typeof getChats!=='function'||typeof getVideoId!=='function'||
       typeof seekTo!=='function') {
      throw new TypeError('Comment search requires loaded chats, video ID and seek action');
    }
    this._getChats=getChats;
    this._getVideoId=getVideoId;
    this._seekTo=seekTo;
    this._onResults=onResults||null;
    this._limit=Number.isSafeInteger(limit)&&limit>=1&&limit<=500?limit:100;
    this._videoId=null;
    this._hits=[];
    this._query='';
    this._total=0;
    this._disposed=false;
  }
  static normalize(value:unknown) {
    return String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
  }
  get state():SearchState {
    return {videoId:this._videoId,query:this._query,total:this._total,
      hits:this._hits.slice(),truncated:this._total>this._hits.length};
  }
  search(query:unknown) {
    if(this._disposed){return this.state;}
    const videoId=this._getVideoId()??null;
    if(videoId!==this._videoId){this._hits=[];this._query='';this._total=0;}
    this._videoId=videoId;
    const normalized=SceneCommentSearch.normalize(query).slice(0,128);
    this._query=normalized;
    this._hits=[];
    this._total=0;
    if(!videoId||!normalized){
      this._onResults?.(this.state);
      return this.state;
    }
    const chats=this._getChats();
    if(!Array.isArray(chats)){this._onResults?.(this.state);return this.state;}
    for(let i=0;i<chats.length;i++){
      const chat:unknown=chats[i];
      if(!chat||typeof chat!=='object'||!('text' in chat)||!('vpos' in chat)||typeof chat.vpos!=='number'||typeof chat.text!=='string'||!Number.isFinite(chat.vpos)||
         chat.vpos<0){continue;}
      if(!SceneCommentSearch.normalize(chat.text).includes(normalized)){continue;}
      this._total++;
      if(this._hits.length<this._limit){
        this._hits.push({text:chat.text,vpos:chat.vpos,
          time:chat.vpos/100,no:'no' in chat?chat.no:undefined,uniqNo:'uniqNo' in chat?chat.uniqNo:undefined});
      }
    }
    this._onResults?.(this.state);
    return this.state;
  }
  select(index:number) {
    if(this._disposed||!Number.isSafeInteger(index)||index<0||
       index>=this._hits.length||this._videoId!==this._getVideoId()){return false;}
    const hit=this._hits[index]!;
    this._seekTo(hit.time,hit);
    return true;
  }
  reset(){
    if(this._disposed){return;}
    this._hits=[];this._total=0;this._query='';this._videoId=null;
    this._onResults?.(this.state);
  }
  dispose(){
    if(this._disposed){return;}
    this.reset();
    this._disposed=true;
    this._onResults=null;
  }
}
