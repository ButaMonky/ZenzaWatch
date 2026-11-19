/** JS implementation and report catalog live in src/PlaybackStartupTrace.js. */
type FailureCheckpoint = {lastStage:string;nextStage:string;elapsedMs:number;phase:string;reason:string};
export interface StartupTrace {
  mark(stage:'player'|'dialog'|'watch'|'info'|'session'|'delivery'):void;
  fail(reason?:'startup-error'|'play-blocked', at?:'play'):FailureCheckpoint|undefined;
  failMedia(error:unknown):FailureCheckpoint|undefined;
  cancel():void;
  observeMedia(element:HTMLMediaElement, expectPlayback?:boolean):void;
}
export interface PlaybackStartupTraceApi {
  reserve(intent:object):StartupTrace;
  adopt(intent:object):StartupTrace;
  abandon(intent:object, failed?:boolean):void;
  describe(stage:unknown):{label:string;file:string}|undefined;
}
