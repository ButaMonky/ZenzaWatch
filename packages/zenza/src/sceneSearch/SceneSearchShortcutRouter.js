// SCUI-08: command bridge used by the selected scene-search UI owner.
// RootDispatcher's existing default command-<name> emitter remains the entry.
//===BEGIN===
class SceneSearchShortcutRouter {
  constructor({controller,interaction,seekStepControl,commentSearchPanel,
    getPreference,setPreference,onToggleControls,onError}={}) {
    if(!controller||typeof getPreference!=='function'||
       typeof setPreference!=='function') {
      throw new TypeError('Scene search shortcuts require an active controller/config');
    }
    this.controller=controller;
    this.interaction=interaction||null;
    this.seekStepControl=seekStepControl||null;
    this.commentSearchPanel=commentSearchPanel||null;
    this._get=getPreference;
    this._set=setPreference;
    this._toggleControls=onToggleControls||null;
    this._error=onError||null;
    this._previousTimeout=null;
  }
  _save(key,value) {
    try {
      this._set(key,value);
      this.controller.onPreferencesChanged(key);
      return true;
    } catch(error) {
      this._error?.(error,key);
      return false;
    }
  }
  _stepChange(direction) {
    if(!this.seekStepControl){return false;}
    const current=this.seekStepControl.seconds;
    const choices=[0,1,3,5,10,15,30,60,120,300,600];
    const idx=choices.findIndex(v=>v>=current);
    if(direction>0) {
      const next=idx<0?600:choices[Math.min(choices.length-1,
        choices[idx]===current?idx+1:idx)];
      return this.seekStepControl.setStep(next);
    }
    const next=idx<0?600:choices[Math.max(0,
      choices[idx]===current?idx-1:idx-1)];
    return this.seekStepControl.setStep(next);
  }
  _layout(direction) {
    const full=this.controller.snapshot.mode==='fullscreen' &&
      this._get('sceneSearch.layout.linkFullscreen')!==true;
    if(['follow','fixed','legacy'].includes(this.controller.snapshot.layoutId)){
      const key=full?'sceneSearch.presentation.fullscreen':'sceneSearch.presentation.normal';
      const choices=['follow','fixed','legacy'],index=choices.indexOf(this.controller.snapshot.layoutId);
      return this._save(key,choices[(index+(direction>0?1:2))%3]);
    }
    const key=full?'sceneSearch.layout.fullscreen':'sceneSearch.layout.normal';
    const value=this._get(key);
    const index=/^(00|0[1-9]|10)$/.test(value)?Number(value):1;
    const next=(index+(direction>0?1:10))%11;
    return this._save(key,String(next).padStart(2,'0'));
  }
  handle(command) {
    if(typeof command!=='string')return false;
    switch(command) {
      case 'sceneSearch-togglePin':
        return !!this.interaction?.togglePin();
      case 'sceneSearch-togglePanel':
        this.controller.show(!this.controller.snapshot.shown);return true;
      case 'sceneSearch-toggleControls':
        if(!this._toggleControls)return false;
        this._toggleControls();return true;
      case 'sceneSearch-nextLayout':return this._layout(1);
      case 'sceneSearch-prevLayout':return this._layout(-1);
      case 'sceneSearch-seekBack':return this.controller.seekBy(-1);
      case 'sceneSearch-seekForward':return this.controller.seekBy(1);
      case 'sceneSearch-stepUp':return this._stepChange(1);
      case 'sceneSearch-stepDown':return this._stepChange(-1);
      case 'sceneSearch-toggleCommentPreview':
        return this._save('sceneSearch.commentPreviewVisible',
          this._get('sceneSearch.commentPreviewVisible')===false);
      case 'sceneSearch-toggleCommentSearch':
        if(!this.commentSearchPanel)return false;
        this.commentSearchPanel.toggle();return true;
      case 'sceneSearch-toggleIdleHide': {
        const current=this._get('sceneSearch.idleHideSeconds');
        if(typeof current!=='number'||!Number.isFinite(current))return false;
        if(current>0)this._previousTimeout=current;
        const value=current===0?(this._previousTimeout||2):0;
        if(!this._save('sceneSearch.idleHideSeconds',value))return false;
        this.interaction?.idlePreferencesChanged();
        return true;
      }
      default:return false;
    }
  }
}
//===END===
export {SceneSearchShortcutRouter};
