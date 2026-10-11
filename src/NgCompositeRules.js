// Composite NG rules: isolated, schema-validated display transformations.
//===BEGIN===
const NG_COLOR_HEX = Object.freeze({
  white:'#FFFFFF',red:'#FF0000',pink:'#FF8080',orange:'#FFC000',
  yellow:'#FFFF00',green:'#00FF00',cyan:'#00FFFF',blue:'#0000FF',
  purple:'#C000FF',black:'#000000',white2:'#CCCC99',
  niconicowhite:'#CCCC99',red2:'#CC0033',truered:'#CC0033',
  pink2:'#FF33CC',orange2:'#FF6600',passionorange:'#FF6600',
  yellow2:'#999900',madyellow:'#999900',green2:'#00CC66',
  elementalgreen:'#00CC66',cyan2:'#00CCCC',blue2:'#3399FF',
  marineblue:'#3399FF',purple2:'#6633CC',nobleviolet:'#6633CC',
  black2:'#666666'
});
class NgCompositeRules {
  static get CONFIG_KEY() {return 'ngComposite.rules';}
  static get COLORS() {return NG_COLOR_HEX;}
  static get FIELDS() {return ['text','regex','cmd','color','size','user','nicoru','position','fork','score','vpos','video'];}
  static get ACTIONS() {return ['hide','hideAuthor','replace','strip','normalize','dim','mask'];}
  static get MAX_RULES() {return 50;}
  static isSafeRegex(pattern) {
    if(typeof pattern!=='string'||pattern.length>160){return false;}
    // Reject common exponential backtracking patterns; bound input length as well.
    return !/(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) &&
      !/(?:\.\*|\.\+){2,}/.test(pattern) && !/\\[1-9]/.test(pattern);
  }
  static validate(rules) {
    if(!Array.isArray(rules)||rules.length>NgCompositeRules.MAX_RULES) {return false;}
    let count=0;
    const str=(v,max=200)=>typeof v==='string'&&v.length<=max;
    const walk=(node,depth)=>{
      if(!node||typeof node!=='object'||++count>350){return false;}
      if(node.kind==='group'){
        return depth<3&&['all','any'].includes(node.mode)&&Array.isArray(node.nodes)&&
          node.nodes.length<=45&&node.nodes.every(n=>walk(n,depth+1));
      }
      if(!NgCompositeRules.FIELDS.includes(node.field)||typeof node.not!=='boolean'||
          !str(node.value,160)||!['contains','equals','notEquals','starts','ends','regex','gte','lte'].includes(node.cmp)){return false;}
      if(node.value.trim()===''||(['nicoru','score','vpos'].includes(node.field)&&
        !['gte','lte','equals'].includes(node.cmp))){return false;}
      if(node.field==='regex'||node.cmp==='regex'){
        if(!NgCompositeRules.isSafeRegex(node.value)){return false;}
        try{new RegExp(node.value,'i');}catch(_){return false;}
      }
      if(['nicoru','score','vpos'].includes(node.field)&&
        !Number.isFinite(Number(node.value))){return false;}
      return true;
    };
    return rules.every(r=>{
      if(!r||typeof r!=='object'||!str(r.id,80)||!str(r.name,90)||
          typeof r.enabled!=='boolean'||!['normal','any','owner','easy'].includes(r.scope)||
          !NgCompositeRules.ACTIONS.includes(r.action)||!['before','after'].includes(r.phase)||
          typeof r.stopOnMatch!=='boolean'||typeof r.exemptNicoru!=='boolean'||
          !Number.isInteger(r.nicoruMin)||r.nicoruMin<0||r.nicoruMin>10000000||
          !['evaluate','skip'].includes(r.unknownPolicy)||
          typeof r.keepProtectedOnAuthorHide!=='boolean'||!str(r.pattern,160)||
          !str(r.replacement,800)||!str(r.mask,800)||typeof r.regexReplace!=='boolean'||
          !str(r.flags,6)||!/^[gimsu]*$/.test(r.flags)||!Array.isArray(r.strip)||
          r.strip.length>40||r.strip.some(c=>!str(c,40))||
          !(r.normalizeColor==='keep'||r.normalizeColor in NG_COLOR_HEX)||
          !['keep','medium','big','small'].includes(r.normalizeSize)||
          !Number.isFinite(r.dim)||r.dim<5||r.dim>100||
          !walk(r.conditions,0)){return false;}
      if(r.action==='replace'&&r.regexReplace){
        if(!NgCompositeRules.isSafeRegex(r.pattern)){return false;}
        try{new RegExp(r.pattern,r.flags);}catch(_){return false;}
      }
      return true;
    });
  }
  static matchScope(rule,chat) {
    const fork=Number(chat.fork);
    return rule.scope==='any'||(rule.scope==='normal'&&fork===0)||
      (rule.scope==='owner'&&fork===1)||(rule.scope==='easy'&&fork===2);
  }
  static nicoru(chat) {
    if(chat.nicoruKnown===false||chat.nicoru===null||chat.nicoru===undefined){return null;}
    const value=Number(chat.nicoru);
    return Number.isFinite(value)&&value>=0?value:null;
  }
  static protected(rule,chat) {
    if(!rule.exemptNicoru){return false;}
    const value=NgCompositeRules.nicoru(chat);
    return value===null?rule.unknownPolicy==='skip':value>=rule.nicoruMin;
  }
  static commandColor(cmd,base) {
    let value=(base||'#FFFFFF').toUpperCase();
    for(const token of String(cmd||'').toLowerCase().split(/\s+/)){
      if(NG_COLOR_HEX[token]){value=NG_COLOR_HEX[token];}
      else if(/^#[a-f0-9]{6}$/i.test(token)){value=token.toUpperCase();}
    }
    return value;
  }
  static matches(node,chat) {
    if(!node){return false;}
    let matched=false;
    let known=true;
    if(node.kind==='group') {
      matched=node.nodes.length>0 && (node.mode==='all'?
        node.nodes.every(n=>NgCompositeRules.matches(n,chat)):
        node.nodes.some(n=>NgCompositeRules.matches(n,chat)));
    }else{
      const f=node.field;
      let actual;
      if(f==='text'||f==='regex'){actual=chat.text;}
      else if(f==='cmd'){actual=chat.cmd;}
      else if(f==='color'){actual=NgCompositeRules.commandColor(chat.cmd,chat.color);}
      else if(f==='size'){actual=chat.size;}
      else if(f==='user'){actual=chat.userId;}
      else if(f==='nicoru'){actual=NgCompositeRules.nicoru(chat);}
      else if(f==='position'){actual=chat.type;}
      else if(f==='fork'){actual=({0:'normal',1:'owner',2:'easy'})[chat.fork]||'other';}
      else if(f==='score'){actual=chat.score;}
      else if(f==='vpos'){actual=Number(chat.vpos)/100;}
      else if(f==='video'){actual=chat.videoId;}
      const expected=f==='color'?(NG_COLOR_HEX[node.value]||node.value).toUpperCase():node.value;
      if(actual!==null&&actual!==undefined){
        if(['gte','lte'].includes(node.cmp)){const a=Number(actual),b=Number(expected);
          matched=Number.isFinite(a)&&Number.isFinite(b)&&(node.cmp==='gte'?a>=b:a<=b);
        }else if(node.cmp==='regex'||f==='regex'){
          try{matched=new RegExp(expected,'i').test(String(actual).slice(0,512));}catch(_){matched=false;}
        }else{
          const a=String(actual),b=String(expected);
          if(node.cmp==='contains'){matched=a.includes(b);}
          else if(node.cmp==='starts'){matched=a.startsWith(b);}
          else if(node.cmp==='ends'){matched=a.endsWith(b);}
          else if(node.cmp==='notEquals'){matched=a!==b;}
          else {matched=a===b;}
        }
      } else {known=false;}
    }
    // NOT must not turn missing data into an ordinary match.
    return known?(node.not?!matched:matched):false;
  }
  static initialState(chat,videoId='') {
    const p=chat.props||chat;
    return {
      text:String(chat.text||''),cmd:String(chat.cmd||''),color:chat.color||'#FFFFFF',
      size:chat.size||'medium',type:chat.type||'naka',
      opacity:Number.isFinite(chat.opacity)?chat.opacity:1,
      nicoru:chat.nicoru,nicoruKnown:chat.nicoruKnown!==undefined?chat.nicoruKnown:p.nicoruKnown,
      userId:chat.userId||'',fork:chat.fork,score:chat.score,vpos:chat.vpos,
      videoId:videoId||'',threadLabel:chat.threadLabel,isCA:chat.isCA
    };
  }
  static applyAction(rule,state) {
    if(rule.action==='hide'||rule.action==='hideAuthor'){state.hidden=true;return;}
    if(rule.action==='mask'){state.text=rule.mask;return;}
    if(rule.action==='dim'){state.opacity*=rule.dim/100;return;}
    if(rule.action==='replace'){
      if(!rule.pattern){return;}
      if(rule.regexReplace){
        try{const re=new RegExp(rule.pattern,rule.flags);
          state.text=state.text.replace(re,rule.replacement);
        }catch(_){/* rejected at validation */}
      }else {state.text=state.text.split(rule.pattern).join(rule.replacement);}
      return;
    }
    let tokens=state.cmd.split(/\s+/).filter(Boolean);
    if(rule.action==='strip'){
      const excluded=new Set(rule.strip.map(v=>v.toLowerCase()));
      tokens=tokens.filter(v=>!excluded.has(v.toLowerCase()));
    }else if(rule.action==='normalize'){
      if(rule.normalizeColor!=='keep'){
        tokens=tokens.filter(t=>!NG_COLOR_HEX[t.toLowerCase()]&&!/^#[a-f\d]{6}$/i.test(t));
        if(rule.normalizeColor!=='white'){tokens.push(rule.normalizeColor);}
      }
      if(rule.normalizeSize!=='keep'){
        tokens=tokens.filter(t=>!['big','small'].includes(t.toLowerCase()));
        if(rule.normalizeSize!=='medium'){tokens.push(rule.normalizeSize);}
      }
    }
    state.cmd=tokens.join(' ');
    state.color=NgCompositeRules.commandColor(state.cmd,'#FFFFFF');
    const lower=tokens.map(t=>t.toLowerCase());
    state.size=lower.includes('big')?'big':lower.includes('small')?'small':'medium';
    // Type/position owns the display group. Style-only actions keep it intact.
    state.type=state.type;
  }
  static project(chats,rules,legacyPredicate=()=>true,videoId='',baselines=null) {
    if(!NgCompositeRules.validate(rules)){return null;}
    const active=rules.filter(r=>r.enabled);
    if(!active.length){return null;}
    const initial=chats.map(chat=>{
      const baseline=baselines?.get?.(chat);
      return baseline?{...baseline,nicoru:chat.nicoru,
        nicoruKnown:chat.nicoruKnown,videoId:videoId||baseline.videoId}:
        NgCompositeRules.initialState(chat,videoId);
    });
    const authorMatches=new Map();
    // Triggered authors are computed over the whole video, including fixed/scrolling groups.
    for(const rule of active.filter(r=>r.action==='hideAuthor')){
      const ids=new Set();
      initial.forEach(s=>{
        if(!s.userId||!NgCompositeRules.matchScope(rule,s)||NgCompositeRules.protected(rule,s)){return;}
        if(rule.phase==='after'&&!legacyPredicate(s)){return;}
        if(NgCompositeRules.matches(rule.conditions,s)){ids.add(s.userId);}
      });
      authorMatches.set(rule.id,ids);
    }
    const results=new Map();
    for(let i=0;i<chats.length;i++){
      const s={...initial[i],hidden:false};
      let stopped=false;
      const applyPhase=phase=>{
        if(stopped){return;}
        for(const r of active){
          if(r.phase!==phase){continue;}
          const ban=r.action==='hideAuthor'&&s.userId&&authorMatches.get(r.id).has(s.userId);
          if(!ban&&!NgCompositeRules.matchScope(r,s)){continue;}
          const protectedChat=NgCompositeRules.protected(r,s);
          if(protectedChat&&!(ban&&r.keepProtectedOnAuthorHide===false)){continue;}
          const hit=r.action==='hideAuthor'?ban:NgCompositeRules.matches(r.conditions,s);
          if(!hit){continue;}
          NgCompositeRules.applyAction(r,s);
          if(r.stopOnMatch||s.hidden){stopped=true;break;}
        }
      };
      applyPhase('before');
      const legacySafe=!s.hidden&&legacyPredicate(s);
      if(legacySafe){applyPhase('after');}
      results.set(chats[i],{...s,visible:legacySafe&&!s.hidden});
    }
    return results;
  }
}
//===END===
export {NgCompositeRules};