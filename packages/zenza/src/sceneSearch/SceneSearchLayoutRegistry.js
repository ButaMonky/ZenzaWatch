// SCUI-11: registration, ownership and creation of at most one active layout.
// Actual mounts are owned and disposed by SceneSearchController.
//===BEGIN===
class SceneSearchLayoutRegistry {
  constructor() {
    this._items=new Map();
  }
  static validId(id) {
    return typeof id==='string' && /^(0[1-9]|10)$/.test(id);
  }
  register({id,label,description='',factory}={}) {
    if(!SceneSearchLayoutRegistry.validId(id) || typeof label!=='string' ||
       !label || typeof factory!=='function' || this._items.has(id)) {
      throw new TypeError('Invalid or duplicate SceneSearch layout: '+String(id));
    }
    this._items.set(id,Object.freeze({id,label,description,factory}));
    return this;
  }
  get(id) {
    return this._items.get(id)||null;
  }
  list() {
    return Array.from(this._items.values(),
      ({id,label,description})=>Object.freeze({id,label,description}));
  }
  has(id) {return this._items.has(id);}
  create({id,mode='normal',document,container,onAction,settings}={}) {
    const definition=this.get(id);
    if(!definition) {throw new RangeError('Layout not registered: '+String(id));}
    if(!document || !container || !['normal','fullscreen'].includes(mode)) {
      throw new TypeError('Layout requires DOM container and screen mode');
    }
    const result=definition.factory({id,mode,document,container,onAction,settings});
    if(!result || typeof result.mount!=='function' ||
       typeof result.render!=='function' || typeof result.dispose!=='function') {
      throw new TypeError('Layout factory does not implement mount/render/dispose: '+id);
    }
    return result;
  }
  makeFactory(shared) {
    return ({id,mode})=>this.create({...shared,id,mode});
  }
}
//===END===
export {SceneSearchLayoutRegistry};
