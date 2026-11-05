/**
 * Read-only fallback geometry for SceneSearchIntegrationBridge preview surfaces.
 * Does not own, clone or move native nodes and never issues a seek command.
 */
type VisibleRectInput={
  root?: HTMLElement|null;
  comment?: HTMLElement|null;
  twin?: HTMLElement|null;
  document?: Document|null;
};
type SceneSeekGeometryInput={
  seekElement:HTMLElement;container:HTMLElement;document:Document;
  pointerClientX?:number|null;unclipped?:boolean;
};
type SceneSeekGeometry={
  seekLeft:number;seekWidth:number;pointerX:number|null;
  visibleLeft:number;visibleRight:number;
};
export class SceneSearchVisibleRectCollector {
  /** Read-only bridge seek geometry, with the old unclipped UI01 contract. */
  static seekGeometry({
    seekElement,container,document,pointerClientX=null,unclipped=false
  }:SceneSeekGeometryInput):SceneSeekGeometry|null {
    const seek=seekElement.getBoundingClientRect?.();
    const frame=container.getBoundingClientRect?.();
    if(!seek||!frame||!Number.isFinite(seek.left)||
       !Number.isFinite(seek.width)||seek.width<=0||
       !Number.isFinite(frame.left)||!Number.isFinite(frame.width)||
       frame.width<=0){return null;}
    const width=container.offsetWidth||frame.width;
    const scale=width/frame.width;
    const viewportWidth=document.defaultView?.innerWidth;
    // UI01 alone uses unclipped screen bounds for a full-width seekRange.
    // Layouts 02..10 retain their old video-box clamps.
    const visibleLeft=Number.isFinite(viewportWidth as number)?
      (unclipped?-frame.left*scale:Math.max(0,-frame.left*scale)):0;
    const visibleRight=Number.isFinite(viewportWidth as number)?
      (unclipped?((viewportWidth as number)-frame.left)*scale:
        Math.min(width,((viewportWidth as number)-frame.left)*scale)):width;
    return {
      seekLeft:(seek.left-frame.left)*scale,
      seekWidth:seek.width*scale,
      pointerX:Number.isFinite(pointerClientX as number)?
        ((pointerClientX as number)-frame.left)*scale:null,
      visibleLeft,visibleRight
    };
  }
  static collect({root=null,comment=null,twin=null,document}:VisibleRectInput): DOMRect[] {
    const nodes=[
      root,
      root?.querySelector<HTMLElement>('.zenzaSceneActions'),
      root?.querySelector<HTMLElement>('.zenzaSceneRemoteControls'),
      comment,twin
    ].filter((node):node is HTMLElement=>Boolean(node));
    const regions:DOMRect[]=[];
    for(const node of new Set(nodes)){
      if(node.hidden||node.closest('[hidden],.is-idle-suppressed'))continue;
      if(node.classList.contains('zenzaSceneCommentAttached')&&
         !node.classList.contains('is-scui-active'))continue;
      const css=document?.defaultView?.getComputedStyle?.(node);
      if(css&&(css.display==='none'||css.visibility==='hidden'||css.opacity==='0'))continue;
      const rect=node.getBoundingClientRect?.();
      if(rect?.width>0&&rect.height>0)regions.push(rect);
    }
    return regions;
  }
}
