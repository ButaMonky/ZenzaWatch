type SceneRect={left:number;top:number;width:number;height:number};
type PlacementResult={rect:SceneRect;imageScale:number;listWidth:number;listMaxHeight:number;footerHeight:number;overlapsVideo:boolean};
type PlacementInput={layout:'follow'|'fixed';context:'normal'|'small'|'fullscreen';
 viewport:SceneRect;player:SceneRect;seekbar:SceneRect;obstacles:SceneRect[];anchorX:number;
 imageSize:{width:number;height:number};requestedScale:number;listOpen:boolean;
 previous:PlacementResult|null;hold:boolean};
export class SceneSearchPlacement {
 static overlap(a:SceneRect,b:SceneRect):number{
  return Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*
   Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
 }
 static compute(input:PlacementInput):PlacementResult{
  const {viewport:v,player,seekbar,listOpen,previous}=input;
  const gap=8,padding=10,minLeft=104;
  const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(Math.max(a,b),n));
  const availableW=Math.max(1,v.width-gap*2),availableH=Math.max(1,v.height-gap*2);
  const iw=Math.max(1,input.imageSize.width),ih=Math.max(1,input.imageSize.height);
  const requested=clamp(Number.isFinite(input.requestedScale)?input.requestedScale:100,50,200)/100;
  let listWidth=listOpen?clamp(availableW-padding-gap-Math.max(minLeft,iw*requested),120,280):0;
  let imageScale=Math.min(requested,Math.max(.05,(availableW-padding-(listOpen?gap+listWidth:0))/iw),
   Math.max(.05,(availableH-padding-158)/ih));
  const leftWidth=Math.max(minLeft,iw*imageScale);
  const footer=Math.ceil(7/Math.max(1,Math.floor((leftWidth+2)/38)))*34+26;
  const width=Math.min(availableW,padding+leftWidth+(listOpen?gap+listWidth:0));
  const height=Math.min(availableH,padding+Math.max(ih*imageScale+footer,listOpen?240:0));
  const listMaxHeight=Math.max(32,height-padding);
  // Very short viewports scroll inside the panel; no stored setting is rewritten.
  const make=(x:number,y:number):SceneRect=>({left:clamp(x,v.left+gap,v.left+v.width-gap-width),
   top:clamp(y,v.top+gap,v.top+v.height-gap-height),width,height});
  const result=(rect:SceneRect):PlacementResult=>({rect,imageScale,listWidth,listMaxHeight,footerHeight:footer,
   overlapsVideo:this.overlap(rect,player)>0});
  if(input.hold&&previous)return result(make(previous.rect.left,previous.rect.top));
  const above=seekbar.top-gap-height;
  if(input.layout==='follow')return result(make(input.anchorX-width/2,above));
  if(input.context==='normal'){
   const below=Math.max(player.top+player.height,seekbar.top+seekbar.height)+gap;
   return result(make(player.left,below+height<=v.top+v.height-gap?below:above));
  }
  if(input.context==='fullscreen')return result(make(player.left+gap,above));
  const hard=[seekbar,...input.obstacles].filter(r=>r.width>0&&r.height>0);
  const safe=(r:SceneRect)=>hard.every(o=>this.overlap(r,o)===0)&&this.overlap(r,player)===0;
  if(previous){
   const kept=make(previous.rect.left,previous.rect.top);
   if(safe(kept))return result(kept);
  }
  const candidates=[make(v.left+gap,above),make(v.left+v.width-gap-width,above)];
  const xs=[v.left+gap,v.left+v.width-gap-width],ys=[v.top+gap,above];
  for(const r of [player,...hard]){
   xs.push(r.left-width-gap,r.left+r.width+gap);
   ys.push(r.top-height-gap,r.top+r.height+gap);
  }
  for(const x of xs)for(const y of ys)candidates.push(make(x,y));
  const origin=previous?.rect||candidates[0]!;
  const score=(r:SceneRect)=>[hard.reduce((sum,o)=>sum+this.overlap(r,o),0),
   this.overlap(r,player),(r.left-origin.left)**2+(r.top-origin.top)**2];
  let best=candidates[0]!,bestScore=score(best);
  for(const r of candidates.slice(1)){
   const next=score(r);
   if(next[0]!<bestScore[0]!||next[0]===bestScore[0]&&(next[1]!<bestScore[1]!||
    next[1]===bestScore[1]&&next[2]!<bestScore[2]!)){best=r;bestScore=next;}
  }
  return result(best);
 }
}
