/**
 * Shared timeline presentation boundary for automatic resume, saved points/ranges
 * and transient AB drafts. Storage and seek actions remain with their owners.
 * TimelineGeometry alone converts time; this presenter converts ratios to CSS.
 */
import {TimelineGeometry} from './TimelineGeometry';

export interface TimelinePointPolicy {clamp?:boolean;includeStart?:boolean;includeEnd?:boolean}
export interface TimelinePointProjection {time:number;ratio:number;left:string}
export interface TimelineIntervalProjection {
  start:TimelinePointProjection|null;end:TimelinePointProjection|null;
  band:{left:string;width:string}|null;
}
type ResumePointer = {hidden: boolean; setAttribute(name: string, value: string): void; removeAttribute(name: string): void};
type ResumePoint = {time?: unknown; now?: unknown};
type StyleTask = [ResumePointer, string, string | number];
export class SceneResumeMarkerPresenter {
  static projectPoint(time:unknown,duration:number,policy:TimelinePointPolicy={}):TimelinePointProjection|null {
    if(typeof time!=='number'||!Number.isFinite(time)||
       !Number.isFinite(duration)||duration<=0)return null;
    if(!policy.clamp&&(time<0||time>duration))return null;
    const ratio=TimelineGeometry.timeToRatio(time,duration);
    if(ratio===null||(policy.includeStart===false&&ratio===0)||
       (policy.includeEnd===false&&ratio===1))return null;
    return {time:TimelineGeometry.ratioToTime(ratio,duration)!,ratio,left:`${ratio*100}%`};
  }
  static projectInterval(start:unknown,end:unknown,duration:number,policy:TimelinePointPolicy={}):TimelineIntervalProjection {
    const a=SceneResumeMarkerPresenter.projectPoint(start,duration,policy);
    const b=SceneResumeMarkerPresenter.projectPoint(end,duration,policy);
    return {start:a,end:b,band:a&&b&&b.ratio>a.ratio?
      {left:a.left,width:`${(b.ratio-a.ratio)*100}%`}:null};
  }
  static placePoint(node:HTMLElement,point:TimelinePointProjection):void {
    node.style.left=point.left;
  }
  static placeInterval(node:HTMLElement,band:NonNullable<TimelineIntervalProjection['band']>):void {
    node.style.left=band.left;node.style.width=band.width;
  }
  /** Every dynamic layer shares its containing track, never viewport pixels. */
  static createLayer(track:HTMLElement,className:string):HTMLElement {
    const layer=track.ownerDocument.createElement('div');
    layer.className=`timelineMarkerLayer ${className}`;
    track.append(layer);
    return layer;
  }
  static clearNative(pointers:readonly ResumePointer[]|null|undefined):void {
    for(const pointer of pointers||[]){
      for(const name of ['timeline-ratio','duration','time','text','data-param'])pointer.removeAttribute(name);
      pointer.hidden=true;
    }
  }
  static render(
    pointers: readonly ResumePointer[] | null | undefined,
    resumePoints: readonly ResumePoint[] | null | undefined,
    duration: number,
    setProps: (...tasks: StyleTask[]) => unknown
  ): void {
    if (!pointers) { return; }
    const length=Number(duration);
    const validDuration=Number.isFinite(length)&&length>0;
    const points=Array.isArray(resumePoints)?resumePoints:[];
    for (let i=0;i<pointers.length;i++) {
      const pointer=pointers[i];
      if (!pointer) { continue; }
      const resume=points[i];
      const time=Number(resume?.time);
      const point=SceneResumeMarkerPresenter.projectPoint(time,length,{includeStart:false});
      if (!validDuration || !resume || !point || typeof resume.now!=='string' || !resume.now.trim()) {
        SceneResumeMarkerPresenter.clearNative([pointer]);
        continue;
      }
      pointer.setAttribute('duration',String(length));
      pointer.setAttribute('time',String(time));
      pointer.setAttribute('text',`${resume.now} ここまで見た`);
      pointer.setAttribute('timeline-ratio',String(point.ratio));
      // A previous video's 'missing' state must never persist onto a valid point.
      pointer.hidden=false;
      if (resume.now!=='前回') {
        setProps(
          [pointer,'--pointer-color','rgba(128, 128, 255, 0.6)'],
          [pointer,'--color','#aef'],
          [pointer,'--scale-pp','']);
      } else {
        // Empty custom properties clear stale per-marker overrides from dated history.
        setProps(
          [pointer,'--pointer-color',''],
          [pointer,'--color',''],
          [pointer,'--scale-pp',1.7]);
      }
    }
  }
}
