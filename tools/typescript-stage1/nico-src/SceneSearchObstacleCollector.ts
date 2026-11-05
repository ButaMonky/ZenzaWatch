/**
 * Typed geometry reader for scene-search collision detection.
 * No layout mutation or click/seek side effects; preserve runtime AST exactly.
 */
export type SceneVisibleRect={
  left:number;top:number;right:number;bottom:number;width:number;height:number;
};
type SceneBounds=Pick<SceneVisibleRect,"left"|"top"|"right"|"bottom">;
type SceneVisibleCSS=CSSStyleDeclaration & {webkitClipPath?:string};
export type SceneObstacleCollectOptions={
  document:Document;
  container:HTMLElement;
  fullscreen?:boolean;
};
export type SceneObstacleResult={
  obstacles:SceneVisibleRect[];
  controlTops:number[];
};
export class SceneSearchObstacleCollector {
  static get SELECTORS() {
    return '.commentInputPanel,.commandDrawer,.commandPopover,.commandMenu,.commandList,'+
      '.zenzaPopupMenu,'+
      '.zenzaSmallModeResizeHandle,.zenzaSmallModeResetButton,'+
      '.zenzaSmallModeAspectLockButton,.closeButton,.zenzaSmallModeCloseButton';
  }
  static get ACTIONS() {
    return 'button,input,textarea,select,a[href],[role="button"],'+
      '[role="menuitem"],[role="option"],[data-action],[tabindex],.controlButton';
  }
  static _rect(rect:DOMRect|null|undefined):SceneVisibleRect|null {
    if(!rect)return null;
    const left=Number(rect.left),top=Number(rect.top);
    const right=Number.isFinite(rect.right)?rect.right:left+Number(rect.width);
    const bottom=Number.isFinite(rect.bottom)?rect.bottom:top+Number(rect.height);
    if(![left,top,right,bottom].every(Number.isFinite)||right<=left||bottom<=top)return null;
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  static _intersect(a:SceneBounds|null,b:SceneBounds|null,axes:string='xy'):SceneVisibleRect|null {
    if(!a||!b)return null;
    const left=axes.includes('x')?Math.max(a.left,b.left):a.left;
    const right=axes.includes('x')?Math.min(a.right,b.right):a.right;
    const top=axes.includes('y')?Math.max(a.top,b.top):a.top;
    const bottom=axes.includes('y')?Math.min(a.bottom,b.bottom):a.bottom;
    return right>left&&bottom>top?{left,top,right,bottom,width:right-left,height:bottom-top}:null;
  }
  // Rectangular CSS clipping; complex paths retain a conservative bounding box.
  static _clipPathRect(style:SceneVisibleCSS,rect:SceneVisibleRect,node:HTMLElement):SceneVisibleRect|null {
    const raw=style.clipPath||style.webkitClipPath||'';
    const match=/^inset\(\s*([^)]*?)\s*\)$/i.exec(raw);
    if(!match)return rect;
    const parts=match[1]!.split(/\s+round\s+/i)[0]!.trim().split(/\s+/);
    if(!parts.length||parts.length>4)return rect;
    const expanded=[parts[0],parts[1]||parts[0],parts[2]||parts[0],
      parts[3]||parts[1]||parts[0]];
    const scaleX=node?.offsetWidth>0?rect.width/node.offsetWidth:1;
    const scaleY=node?.offsetHeight>0?rect.height/node.offsetHeight:1;
    const px=(part:string|undefined,length:number,scale:number):number|null=>{
      const value=/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|%)?$/.exec(part as string);
      if(!value)return null;
      return Number(value[1])*(value[2]==='%'?length/100:scale);
    };
    const [t,r,b,l]=[px(expanded[0],rect.height,scaleY),px(expanded[1],rect.width,scaleX),
      px(expanded[2],rect.height,scaleY),px(expanded[3],rect.width,scaleX)];
    if([t,r,b,l].some(v=>v===null))return rect;
    return this._intersect(rect,{left:rect.left+l!,top:rect.top+t!,
      right:rect.right-r!,bottom:rect.bottom-b!});
  }
  static _opaqueBackground(style:SceneVisibleCSS):boolean {
    const color=(style.backgroundColor||'').trim().toLowerCase();
    const alpha=/^rgba\([^)]*,\s*([.\d]+)\s*\)$/.exec(color);
    const painted=!!color&&color!=='transparent'&&color!=='rgba(0, 0, 0, 0)'&&
      !(alpha&&Number(alpha[1])===0)&&
      !/^#[a-f0-9]{3}0$/i.test(color);
    return painted||(!!style.backgroundImage&&style.backgroundImage!=='none');
  }
  static collect({document,container,fullscreen=false}:SceneObstacleCollectOptions):SceneObstacleResult {
    const win=document.defaultView;
    if(!win?.getComputedStyle)return {obstacles:[],controlTops:[]};
    const styles=new Map<HTMLElement,SceneVisibleCSS>(),rects=new Map<HTMLElement,SceneVisibleRect|null>(),seen=new Set<HTMLElement>();
    const style=(node:HTMLElement):SceneVisibleCSS=>{
      if(!styles.has(node))styles.set(node,win.getComputedStyle(node));
      return styles.get(node)!;
    };
    const rect=(node:HTMLElement):SceneVisibleRect|null=>{
      if(!rects.has(node))rects.set(node,this._rect(node.getBoundingClientRect?.()));
      return rects.get(node)!;
    };
    const visible=(node:HTMLElement|null):SceneVisibleRect|null=>{
      if(!node||node.nodeType!==1)return null;
      if(!['visible',''].includes(style(node).visibility))return null;
      let box=rect(node);
      if(!box)return null;
      // A viewport-fixed popup escapes overflow-only ancestors. Transforms,
      // filters and paint containment instead establish a local fixed
      // containing block, where overflow clipping applies again.
      let fixedEscapesOverflow=style(node).position==='fixed';
      if(fixedEscapesOverflow){
        for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement){
          const css=style(ancestor);
          if((css.transform&&css.transform!=='none')||
            (css.filter&&css.filter!=='none')||
            (css.perspective&&css.perspective!=='none')||
            /\b(paint|layout|strict|content)\b/.test(css.contain||'')||
            /\b(transform|filter|perspective)\b/.test(css.willChange||'')){
            fixedEscapesOverflow=false;
            break;
          }
        }
      }
      for(let current:HTMLElement|null=node;current;current=current.parentElement){
        const css=style(current);
        if(css.display==='none'||css.contentVisibility==='hidden')return null;
        const opacity=Number.parseFloat(css.opacity||'1');
        if(Number.isFinite(opacity)&&opacity<=0)return null;
        // An ancestor can hide descendants through clipping or compositing.
        // visibility:hidden differs: a descendant may override it to visible.
        if(current!==node&&!fixedEscapesOverflow){
          const overflowX=css.overflowX||css.overflow||'visible';
          const overflowY=css.overflowY||css.overflow||'visible';
          let axes='';
          if(/^(hidden|clip|auto|scroll)$/.test(overflowX)||
            /^(hidden|clip|auto|scroll)$/.test(css.overflow))axes+='x';
          if(/^(hidden|clip|auto|scroll)$/.test(overflowY)||
            /^(hidden|clip|auto|scroll)$/.test(css.overflow))axes+='y';
          if(axes){
            const bounds=rect(current);
            if(bounds)box=this._intersect(box,bounds,axes);
          }
        }
        const clip=css.clipPath||css.webkitClipPath;
        if(box&&clip&&clip!=='none'){
          const bounds=rect(current);
          if(bounds)box=this._intersect(box,this._clipPathRect(css,bounds,current));
        }
        if(!box)return null;
      }
      return box;
    };
    const obstacles:SceneVisibleRect[]=[],controlTops:number[]=[];
    const add=(node:HTMLElement,control:boolean=false):boolean=>{
      const box=visible(node);
      if(!box)return false;
      if(!seen.has(node)){
        obstacles.push(box);
        seen.add(node);
      }
      if(control)controlTops.push(box.top);
      return true;
    };
    const controls=fullscreen?
      ',.videoControlBar .controlItemContainer,.controlItemContainer.right,'+
        '.controlItemContainer.left,.controlItemContainer.center':'';
    for(const node of container.querySelectorAll<HTMLElement>(this.SELECTORS+controls)){
      const control=fullscreen&&node.classList.contains('controlItemContainer');
      const css=style(node);
      const comment=node.matches('.commentInputPanel');
      const activeComment=comment&&(node.matches(':focus-within,:hover')||
        node.classList.contains('is-popoverOpen'));
      // The idle comment container is often transparent but still has an
      // enormous hit rectangle. Its separately visible popup is scanned below.
      if(comment&&!activeComment)continue;
      const children=[...node.querySelectorAll<HTMLElement>(this.ACTIONS)]
        .filter(child=>style(child).pointerEvents!=='none'&&visible(child));
      const transparent=!this._opaqueBackground(css);
      const childOnly=control||css.pointerEvents==='none'||(!comment&&
        transparent&&children.length>0);
      if(childOnly){
        for(const child of children)add(child,control);
        // Legacy fixture/control rows sometimes expose a single hit surface
        // without separate child buttons. Preserve their actual hit rectangle.
        if(!children.length&&css.pointerEvents!=='none')add(node,control);
        else if(!children.length&&!control&&!transparent)add(node,false);
      }else{
        const parentBox=visible(node);
        if(parentBox){
          add(node,control);
          // Popups may extend beyond the painted parent frame.
          for(const child of children){
            const childBox=visible(child);
            if(childBox&&this._intersect(childBox,parentBox)?.width!==childBox.width)
              add(child,control);
          }
        }else{
          // visibility:hidden parents can contain explicitly visible actions.
          for(const child of children)add(child,control);
        }
      }
    }
    return {obstacles,controlTops};
  }
}
