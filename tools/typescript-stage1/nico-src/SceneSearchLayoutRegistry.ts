/**
 * Registers layout providers, creates one layout at a time on demand.
 * Only explicit lifecycle methods define a valid provider.
 * Preserve the original JS runtime, including all rejection paths.
 */
type RegistryLayout = {
  mount:(...args:unknown[])=>unknown;
  render:(...args:unknown[])=>unknown;
  dispose:()=>unknown;
};
type RegistryEntry = {
  id:string;
  label:string;
  description:unknown;
  factory:unknown;
};
type RegistryInput = {
  id?:unknown;
  label?:unknown;
  description?:unknown;
  factory?:unknown;
};
type RegistryCreateInput = {
  id?:unknown;
  mode?:unknown;
  document?:unknown;
  container?:unknown;
  onAction?:unknown;
  settings?:unknown;
};
export class SceneSearchLayoutRegistry {
  declare private _items:Map<string,RegistryEntry>;
  constructor() {
    this._items=new Map();
  }
  static validId(id:unknown):id is string {
    return typeof id==='string' && /^(00|0[1-9]|10|follow|fixed|legacy)$/.test(id);
  }
  register({id,label,description='',factory}:RegistryInput={}):this {
    if(!SceneSearchLayoutRegistry.validId(id) || typeof label!=='string' ||
       !label || typeof factory!=='function' || this._items.has(id)) {
      throw new TypeError('Invalid or duplicate SceneSearch layout: '+String(id));
    }
    this._items.set(id,Object.freeze({id,label,description,factory}));
    return this;
  }
  get(id:unknown):RegistryEntry|null {
    return this._items.get(id as string)||null;
  }
  list():ReadonlyArray<Readonly<Pick<RegistryEntry,'id'|'label'|'description'>>> {
    return Array.from(this._items.values(),
      ({id,label,description})=>Object.freeze({id,label,description}));
  }
  has(id:unknown):boolean {return this._items.has(id as string);}
  create({id,mode='normal',document,container,onAction,settings}:RegistryCreateInput={}):RegistryLayout {
    const definition=this.get(id);
    if(!definition) {throw new RangeError('Layout not registered: '+String(id));}
    if(!document || !container || !['normal','fullscreen'].includes(mode as string)) {
      throw new TypeError('Layout requires DOM container and screen mode');
    }
    const result=(definition.factory as (options:RegistryCreateInput)=>unknown)(
      {id,mode,document,container,onAction,settings});
    if(!result || typeof (result as RegistryLayout).mount!=='function' ||
       typeof (result as RegistryLayout).render!=='function' ||
       typeof (result as RegistryLayout).dispose!=='function') {
      throw new TypeError('Layout factory does not implement mount/render/dispose: '+id);
    }
    return result as RegistryLayout;
  }
  makeFactory(shared:Omit<RegistryCreateInput,'id'|'mode'>) {
    return ({id,mode}:{id:unknown;mode?:unknown})=>this.create({...shared,id,mode});
  }
}
