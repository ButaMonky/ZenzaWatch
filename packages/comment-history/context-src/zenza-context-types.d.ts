import type {HistoryContext,HistoryFork,NormalizedThread} from './core.mjs';
export interface ZenzaThreadDescriptor {
  id:string|number;fork:number;forkLabel:HistoryFork;label:string;
  layer?:{index:number;isTranslucent?:boolean};
}
export interface ZenzaRenderDescriptor {
  id:string;fork:number;forkLabel:HistoryFork;label:string;
  layer:{index:number;isTranslucent?:boolean};
}
export interface ZenzaSeedOptions {
  playbackGeneration:string;normalRevision:number;
  videoInfo:{
    videoId:string;contextWatchId?:string|number|null;
    watchId?:string|number|null;duration:number;
    msgInfo?:{
      videoId:string;
      nvComment?:{server?:string;threadKey?:string;
        params?:{targets?:readonly unknown[]}};
      threads?:ZenzaThreadDescriptor[];
    };
  };
  normalResult:{
    format?:string;
    threadInfo?:{videoId:string;when?:number|null;
      threadId?:string|number|null;language?:string;isWaybackMode?:boolean};
    body?:{__usedLanguage?:string;threads:NormalizedThread[]};
  };
}
export interface ZenzaSeed {
  context:HistoryContext;
  identity:{videoId:string;watchId:string;language:string;
    playbackGeneration:string;normalRevision:number};
  baseline:NormalizedThread[];
  historyStartWhen:number|null;
  render:{duration:number;mainThreadId:string|number|null;
    threads:ZenzaRenderDescriptor[]};
}
export interface ZenzaRenderThread extends NormalizedThread {
  info:ZenzaRenderDescriptor;
}
