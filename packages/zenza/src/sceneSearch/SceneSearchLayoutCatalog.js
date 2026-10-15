// SCUI-18: deterministic registration of distinct UI strategies.
// This module never mounts cards, registers player event handlers or loads video.
//===BEGIN===
class SceneSearchLayoutCatalog {
  static get IDS() {
    return ['01','02','03','04','05','06','07','08','09','10'];
  }
  static install(registry,{
    Card,registerClassic,SideShelf,PlaybackDeck,Filmstrip,Drawer,SmartAvoid,
    clock,allowPartial=false
  }={}) {
    if(!registry||typeof registry.list!=='function'||
       typeof registry.register!=='function'||typeof Card!=='function'){
      throw new TypeError('Scene layout catalog requires a registry and card');
    }
    // Stage every provider first. Invalid plugins must not corrupt live registry.
    const staging=new registry.constructor();
    if(typeof staging.register!=='function'||typeof staging.get!=='function'){
      throw new TypeError('Registry must support isolated staging');
    }
    const providers=[
      {name:'01/02',ids:['01','02'],call:registerClassic&&
        (()=>registerClassic(staging))},
      {name:'03/04',ids:['03','04'],call:SideShelf?.install&&
        (()=>SideShelf.install(staging,Card))},
      {name:'05/06',ids:['05','06'],call:PlaybackDeck?.register&&
        (()=>PlaybackDeck.register(staging,{Card}))},
      {name:'07',ids:['07'],call:Filmstrip?.install&&
        (()=>Filmstrip.install(staging,Card))},
      {name:'08/09',ids:['08','09'],call:Drawer?.install?
        (()=>Drawer.install(staging,Card)):
        Drawer?.register?(()=>Drawer.register(staging,{Card})):null},
      {name:'10',ids:['10'],call:SmartAvoid?.register&&
        (()=>SmartAvoid.register(staging,{Card,clock}))}
    ];
    const missing=providers.filter(p=>typeof p.call!=='function');
    if(missing.length&&!allowPartial){
      throw new Error('Scene layout providers missing: '+
        missing.map(p=>p.name).join(', '));
    }
    // Verify all declared IDs are absent before starting. A failed import
    // should not silently register a duplicate fallback implementation.
    const taken=new Set(registry.list().map(item=>item.id));
    for(const group of providers){
      if(!group.call){continue;}
      for(const id of group.ids){
        if(taken.has(id)){throw new Error('Already registered: '+id);}
      }
    }
    for(const group of providers){
      if(!group.call){continue;}
      const before=new Set(staging.list().map(item=>item.id));
      group.call();
      const added=staging.list().filter(item=>!before.has(item.id))
        .map(item=>item.id).sort();
      const expected=group.ids.slice().sort();
      if(added.join(',')!==expected.join(',')){
        throw new Error('Scene layout provider '+group.name+
          ' registered '+added.join(',')+' instead of '+expected.join(','));
      }
    }
    const installed=staging.list().map(item=>item.id).sort();
    const absent=SceneSearchLayoutCatalog.IDS.filter(id=>!installed.includes(id));
    if(absent.length&&!allowPartial){
      throw new Error('Scene layout coverage incomplete: '+absent.join(','));
    }
    for(const id of installed){registry.register(staging.get(id));}
    return Object.freeze({
      registered:Object.freeze(installed),
      missing:Object.freeze(absent),
      complete:absent.length===0
    });
  }
}
//===END===
export {SceneSearchLayoutCatalog};