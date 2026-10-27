// Composite NG rules: isolated, schema-validated display transformations.
// Task555: staged canonical TypeScript source for NgCompositeRules.
export interface NgCompositeRuleDraft {
  id: string;
  enabled?: boolean;
  [field: string]: unknown;
}
type RegexSymbolSet=Set<string>|null;
interface RegexAtom {
  first: RegexSymbolSet;
  chars: RegexSymbolSet;
  min: number;
  variable: boolean;
  ambiguous: boolean;
  words: string[] | null;
}
/** Dynamic JSON is always checked at runtime before it is accepted as a rule. */
interface NgCompositeValidationNode {
  id: string;
  kind?: string;
  not?: boolean;
  mode: string;
  nodes: NgCompositeValidationNode[];
  field: string;
  cmp: string;
  value: string;
}
interface NgCompositeValidationRule {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  action: string;
  phase: string;
  stopOnMatch: boolean;
  exemptNicoru: boolean;
  nicoruMin: number;
  unknownPolicy: string;
  keepProtectedOnAuthorHide: boolean;
  pattern: string;
  replacement: string;
  mask: string;
  regexReplace: boolean;
  flags: string;
  strip: string[];
  normalizeColor: string;
  normalizeSize: string;
  dim: number;
  conditions: NgCompositeValidationNode;
}
/** Minimal read-only fields used for scope / nicoru-protection decisions. */
export interface NgCompositePolicyChat {
  fork?: unknown;
  nicoruKnown?: unknown;
  nicoru?: unknown;
}
/** Raw chat properties read when building the non-destructive NG display state. */
export interface NgCompositeInitialChat extends NgCompositePolicyChat {
  text?: unknown;
  cmd?: unknown;
  color?: string | null;
  size?: string | null;
  type?: string | null;
  opacity?: number;
  userId?: string | number | null;
  score?: number;
  vpos?: number;
  threadLabel?: string;
  isCA?: boolean;
  props?: {nicoruKnown?: unknown} | null;
}
/** Numeric and string metadata probed by a display-time condition match. */
export interface NgCompositeMatchChat extends NgCompositeInitialChat {
  videoId?: unknown;
}
/** Mutated only in a temporary rendering projection, not in original chat input. */
export interface NgCompositeActionState {
  text: string;
  cmd: string;
  color: string;
  size: string;
  opacity: number;
  hidden?: boolean;
}
/** Validated snapshot and compiled regex cache reused per video projection. */
interface NgCompositeProgram {
  rules: readonly NgCompositeValidationRule[];
  active: readonly NgCompositeValidationRule[];
  regexCache: Map<string,RegExp>;
  before: readonly NgCompositeValidationRule[];
  after: readonly NgCompositeValidationRule[];
  hasAuthors: boolean;
}
/** Display-only state and result of a successful projection. */
type NgCompositeProjectionState = ReturnType<typeof NgCompositeRules.initialState> & {
  hidden: boolean;
  visible: boolean;
  stopped: boolean;
  legacyRejected: boolean;
};
type NgCompositeProjectionResult = {
  results: Map<NgCompositeInitialChat,NgCompositeProjectionState>;
  authorMatches: Map<string,Set<string|number>>;
};
//===BEGIN===
const NG_COLOR_HEX: Readonly<Record<string,string>> = Object.freeze({
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
  declare static _programs: WeakSet<object> | undefined;
  static get CONFIG_KEY() {return 'ngComposite.rules';}
  static get COLORS() {return NG_COLOR_HEX;}
  static get FIELDS() {return ['text','regex','cmd','color','size','user','nicoru','position','fork','score','vpos','video'];}
  static get ACTIONS() {return ['hide','hideAuthor','replace','strip','normalize','dim','mask'];}
  static get MAX_RULES() {return 50;}
  static isSafeRegex(pattern: unknown,flags: string='i') {
    if(typeof pattern!=='string'||!pattern||pattern.length>160||!NgCompositeRules.validFlags(flags))return false;
    // Conservative structural analysis, not a ban on every repeated group.
    // Repeated bodies must be non-nullable, non-ambiguous and have no variable repetition.
    const ANY=null,empty=():Set<string>=>new Set<string>(),union=(a: RegexSymbolSet,b: RegexSymbolSet):RegexSymbolSet=>a===ANY||b===ANY?ANY:new Set([...a,...b]);
    // Use the engine's i/u equivalence, including Unicode simple case folding.
    // Proof expressions contain escaped literals only, never user regex syntax.
    const ignoreCase=flags.includes('i'),proofFlags=(ignoreCase?'i':'')+(flags.includes('u')?'u':'');
    const proofCache=new Map<string,RegExp>();
    const literalTest=(word: string,value: string,prefix=false):boolean=>{
      const key=JSON.stringify([word,prefix]);let re=proofCache.get(key);
      if(!re){
        const escaped=word.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
        re=new RegExp('^(?:'+escaped+')'+(prefix?'':'$'),proofFlags);proofCache.set(key,re);
      }
      return re.test(value);
    };
    const overlap=(a: RegexSymbolSet,b: RegexSymbolSet):boolean=>{
      if(a===ANY||b===ANY)return true;
      for(const c of a){
        if(b.has(c))return true;
        if(ignoreCase)for(const d of b)if(literalTest(c,d))return true;
      }
      return false;
    };
    const atom=(chars: RegexSymbolSet,word: string|null,min=1):RegexAtom=>({first:chars,chars,min,variable:false,ambiguous:false,words:word===null?null:[word]});
    // UTF-16 atoms cannot prove Unicode code-point alternatives disjoint.
    const literal=(s: string):RegexAtom=>/[\ud800-\udfff]/.test(s)?atom(ANY,null):atom(new Set([s]),s);
    const zero=():RegexAtom=>atom(empty(),'',0);
    const wordsJoin=(a: string[]|null,b: string[]|null):string[]|null=>!a||!b||a.length*b.length>32||
      a.some(x=>b.some(y=>x.length+y.length>160))?null:a.flatMap(x=>b.map(y=>x+y));
    const prefixFree=(a: string[]|null,b: string[]|null):boolean|null=>a&&b&&!a.some(x=>b.some(y=>ignoreCase?
      literalTest(x,y,true)||literalTest(y,x,true):x.startsWith(y)||y.startsWith(x)));
    let i=0,depth=0;
    const fail=():never=>{throw new Error('Unsupported or ambiguous regexp');};
    const sequence=():RegexAtom=>{
      const parts:RegexAtom[]=[];
      while(i<pattern.length&&![')', '|'].includes(pattern[i])){
        let a=readAtom(),min=1,max=1;
        const q=pattern[i];
        if(q==='*'||q==='+'||q==='?'){i++;min=q==='+'?1:0;max=q==='?'?1:Infinity;}
        else if(q==='{'){
          const m=/^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(i));
          if(m){i+=m[0].length;min=Number(m[1]);max=m[2]===undefined?min:m[2]===''?Infinity:Number(m[2]);}
        }
        if(min>1024||max!==Infinity&&max>1024||max<min)fail();
        if(max>1&&(a.min===0||a.variable||a.ambiguous))fail();
        if(min!==1||max!==1){
          if(pattern[i]==='?')i++;
          a={...a,min:a.min*min,variable:a.variable||min!==max,
            words:min===max&&min<=4?Array.from({length:min}).reduce<string[]|null>(w=>wordsJoin(w,a.words),['']):null};
        }
        parts.push(a);
      }
      for(let p=0;p<parts.length;p++)if(parts[p].variable){
        for(let q=p+1;q<parts.length;q++)if(parts[q].variable&&overlap(parts[p].chars,parts[q].chars)){
          if(!parts.slice(p+1,q).some(x=>x.min>0&&!overlap(x.chars,parts[p].chars)))fail();
        }
      }
      let out=zero(),nullable=true;
      for(const a of parts){
        if(nullable)out.first=union(out.first,a.first);
        nullable=nullable&&a.min===0;out.chars=union(out.chars,a.chars);out.min+=a.min;
        out.variable=out.variable||a.variable;out.ambiguous=out.ambiguous||a.ambiguous;
        out.words=wordsJoin(out.words,a.words);
      }
      return out;
    };
    const expression=():RegexAtom=>{
      const branches=[sequence()];
      while(pattern[i]==='|'){i++;branches.push(sequence());}
      const out={...branches[0]};
      for(let p=0;p<branches.length;p++)for(let q=p+1;q<branches.length;q++){
        if(overlap(branches[p].first,branches[q].first)&&!prefixFree(branches[p].words,branches[q].words))out.ambiguous=true;
      }
      for(const a of branches.slice(1)){
        out.first=union(out.first,a.first);out.chars=union(out.chars,a.chars);out.min=Math.min(out.min,a.min);
        out.variable=out.variable||a.variable;out.ambiguous=out.ambiguous||a.ambiguous;
        out.words=out.words&&a.words&&out.words.length+a.words.length<=32?[...out.words,...a.words]:null;
      }
      return out;
    };
    const readAtom=():RegexAtom=>{
      const ch=pattern[i++];
      if(ch==='('){
        if(++depth>12)fail();
        if(pattern.slice(i,i+2)==='?:')i+=2;
        else if(pattern[i]==='?')fail(); // Lookarounds/named groups are outside this initial subset.
        const a=expression();if(pattern[i++]!==')')fail();depth--;return a;
      }
      if(ch==='['){
        const start=i-1;
        while(i<pattern.length){if(pattern[i]==='\\'){i+=2;continue;}if(pattern[i++]===']')break;}
        const raw=pattern.slice(start,i);if(!raw.endsWith(']'))fail();
        if(raw[1]==='^'||/\\|[^\x00-\x7f]/.test(raw))return atom(ANY,null);
        const re=new RegExp('^(?:'+raw+')$',proofFlags),chars=empty();
        for(let n=0;n<128;n++){const c=String.fromCharCode(n);if(re.test(c))chars.add(c);}
        return atom(chars,null);
      }
      if(ch==='.')return atom(ANY,null);
      if(ch==='^'||ch==='$')return zero();
      if(ch==='\\'){
        const e=pattern[i++];if(!e||/[1-9k]/.test(e))fail();
        if(e==='b'||e==='B')return zero();
        if(e==='d')return atom(new Set('0123456789'),null);
        if(e==='w')return atom(new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'),null);
        if(e==='s')return atom(new Set([' ','\t','\n','\r','\f','\v','\u00a0','\u1680',
          '\u2000','\u2001','\u2002','\u2003','\u2004','\u2005','\u2006','\u2007','\u2008',
          '\u2009','\u200a','\u2028','\u2029','\u202f','\u205f','\u3000','\ufeff']),null);
        if(/[DSW]/.test(e))return atom(ANY,null);
        if(e==='p'||e==='P'){
          const m=/^\{[A-Za-z_=]+\}/.exec(pattern.slice(i));if(!m||!flags.includes('u'))fail();i+=m![0].length;return atom(ANY,null);
        }
        if(e==='x'||e==='u'){
          const size=e==='x'?2:4;
          const hex=pattern.slice(i,i+size);if(!new RegExp('^[0-9a-f]{'+size+'}$','i').test(hex))fail();
          i+=size;return literal(String.fromCharCode(parseInt(hex,16)));
        }
        if(e==='0'){if(/\d/.test(pattern[i]||''))fail();return literal('\0');}
        if(e==='c')fail();
        return literal(({n:'\n',r:'\r',t:'\t',f:'\f',v:'\v'})[e]||e);
      }
      if(!ch||'*+?)'.includes(ch))fail();
      return literal(ch);
    };
    try{expression();if(i!==pattern.length)return false;new RegExp(pattern,flags);return true;}
    catch(_){return false;}
  }
  static validFlags(flags: unknown): boolean {
    return typeof flags==='string'&&/^[gimsu]*$/.test(flags)&&new Set(flags).size===flags.length;
  }
  static get MAX_REGEX_INPUT(){return 2048;}
  static color(value: unknown): string | null {
    if(typeof value!=='string')return null;
    const key=value.toLowerCase();
    if(Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,key))return NG_COLOR_HEX[key];
    return /^#[0-9a-f]{6}$/i.test(value)?value.toUpperCase():null;
  }
  static number(value: unknown): number | null {
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())){
      const n=Number(value);return Number.isFinite(n)?n:null;
    }
    return null;
  }
  static validate(rules: unknown): boolean {
    try{return NgCompositeRules._validate(rules);}catch(_){return false;}
  }
  static _validate(rules: unknown): boolean {
    if(!Array.isArray(rules)||rules.length>NgCompositeRules.MAX_RULES) {return false;}
    let count=0,nodeIds=new Set();
    const str=(v: unknown,max=200): v is string=>typeof v==='string'&&v.length<=max;
    const walk=(node: NgCompositeValidationNode,depth: number):boolean=>{
      if(!node||typeof node!=='object'||++count>350||typeof node.id!=='string'||
          !node.id.trim()||node.id.length>80||nodeIds.has(node.id)){return false;}
      nodeIds.add(node.id);
      if(node.kind==='group'){
        return (node.not===undefined||node.not===false)&&depth<3&&['all','any'].includes(node.mode)&&Array.isArray(node.nodes)&&
          node.nodes.length>0&&node.nodes.length<=45&&node.nodes.every(n=>walk(n,depth+1));
      }
      if(Object.prototype.hasOwnProperty.call(node,'nodes')||!NgCompositeRules.FIELDS.includes(node.field)||typeof node.not!=='boolean'||
          !str(node.value,160)||!['contains','equals','notEquals','starts','ends','regex','gte','lte'].includes(node.cmp)){return false;}
      if(node.value.trim()===''||(['nicoru','score','vpos'].includes(node.field)&&
        !['gte','lte','equals'].includes(node.cmp))){return false;}
      if(node.field==='color'&&!NgCompositeRules.color(node.value)){return false;}
      if(node.field==='regex'||node.cmp==='regex'){
        if(!NgCompositeRules.isSafeRegex(node.value)){return false;}
        try{new RegExp(node.value,'i');}catch(_){return false;}
      }
      if(['nicoru','score','vpos'].includes(node.field)&&
        NgCompositeRules.number(node.value)===null){return false;}
      return true;
    };
    const ruleIds=new Set();
    return rules.every((r: NgCompositeValidationRule)=>{
      nodeIds=new Set();
      if(!r||typeof r!=='object'||!str(r.id,80)||!r.id.trim()||ruleIds.has(r.id)||
          !str(r.name,90)||
          typeof r.enabled!=='boolean'||!['normal','any','owner','easy'].includes(r.scope)||
          !NgCompositeRules.ACTIONS.includes(r.action)||!['before','after'].includes(r.phase)||
          typeof r.stopOnMatch!=='boolean'||typeof r.exemptNicoru!=='boolean'||
          !Number.isInteger(r.nicoruMin)||r.nicoruMin<0||r.nicoruMin>10000000||
          !['evaluate','skip'].includes(r.unknownPolicy)||
          typeof r.keepProtectedOnAuthorHide!=='boolean'||!str(r.pattern,160)||
          !str(r.replacement,800)||!str(r.mask,800)||typeof r.regexReplace!=='boolean'||
          !str(r.flags,5)||!NgCompositeRules.validFlags(r.flags)||!Array.isArray(r.strip)||
          r.strip.length>40||r.strip.some(c=>!str(c,40)||
            !Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,c.toLowerCase())&&
            !['big','small'].includes(c.toLowerCase())&&
            !/^#[0-9a-f]{6}$/i.test(c))||
          !(r.normalizeColor==='keep'||NgCompositeRules.color(r.normalizeColor))||
          !['keep','medium','big','small'].includes(r.normalizeSize)||
          !Number.isFinite(r.dim)||r.dim<5||r.dim>100||
          r.conditions?.kind!=='group'||!walk(r.conditions,0)){return false;}
      if(r.action==='replace'&&!r.pattern){return false;}
      if(r.action==='replace'&&r.regexReplace){
        if(!NgCompositeRules.isSafeRegex(r.pattern,r.flags)){return false;}
        try{new RegExp(r.pattern,r.flags);}catch(_){return false;}
      }
      ruleIds.add(r.id);
      return true;
    });
  }
  static matchScope(rule: Pick<NgCompositeValidationRule, "scope">,chat: NgCompositePolicyChat): boolean {
    const fork=Number(chat.fork);
    return rule.scope==='any'||(rule.scope==='normal'&&fork===0)||
      (rule.scope==='owner'&&fork===1)||(rule.scope==='easy'&&fork===2);
  }
  static nicoru(chat: NgCompositePolicyChat): number | null {
    if(chat.nicoruKnown===false||chat.nicoru===null||chat.nicoru===undefined){return null;}
    const value=NgCompositeRules.number(chat.nicoru);
    return value!==null&&value>=0?value:null;
  }
  static protected(rule: Pick<NgCompositeValidationRule, "exemptNicoru" | "unknownPolicy" | "nicoruMin">,chat: NgCompositePolicyChat): boolean {
    if(!rule.exemptNicoru){return false;}
    const value=NgCompositeRules.nicoru(chat);
    return value===null?rule.unknownPolicy==='skip':value>=rule.nicoruMin;
  }
  static commandColor(cmd: unknown,base: unknown): string {
    let value=NgCompositeRules.color(base)||'#FFFFFF';
    for(const token of String(cmd||'').toLowerCase().split(/\s+/)){
      if(Object.prototype.hasOwnProperty.call(NG_COLOR_HEX,token)){value=NG_COLOR_HEX[token];}
      else if(/^#[a-f0-9]{6}$/i.test(token)){value=token.toUpperCase();}
    }
    return value;
  }
  static matches(node: NgCompositeValidationNode | null,chat: NgCompositeMatchChat,regexCache: Map<string,RegExp> | null=null): boolean {
    if(!node){return false;}
    let matched=false;
    let known=true;
    if(node.kind==='group') {
      if(node.not!==undefined&&node.not!==false)return false;
      matched=node.nodes.length>0 && (node.mode==='all'?
        node.nodes.every(n=>NgCompositeRules.matches(n,chat,regexCache)):
        node.nodes.some(n=>NgCompositeRules.matches(n,chat,regexCache)));
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
      else if(f==='fork'){actual=({0:'normal',1:'owner',2:'easy'})[chat.fork as 0 | 1 | 2]||'other';}
      else if(f==='score'){actual=chat.score;}
      else if(f==='vpos'){const n=NgCompositeRules.number(chat.vpos);actual=n===null?null:n/100;}
      else if(f==='video'){actual=chat.videoId;}
      const expected=f==='color'?NgCompositeRules.color(node.value):node.value;
      if(f==='color'&&expected===null)return false;
      if(actual!==null&&actual!==undefined&&
          (!['score','vpos'].includes(f)||Number.isFinite(Number(actual)))){
        if(['nicoru','score','vpos'].includes(f)){
          const a=NgCompositeRules.number(actual),b=NgCompositeRules.number(expected);
          known=a!==null&&b!==null;
          matched=known&&(node.cmp==='gte'?(a as number)>=(b as number):node.cmp==='lte'?(a as number)<=(b as number):a===b);
        }else if(node.cmp==='regex'||f==='regex'){
          try{
            const cacheKey=JSON.stringify([expected,'i']);
            let regexp=regexCache?.get(cacheKey);
            if(!regexp){
              if(!NgCompositeRules.isSafeRegex(expected,'i'))return false;
              regexp=new RegExp(expected as string,'i');regexCache?.set(cacheKey,regexp);
            }
            const text=String(actual);
            if(text.length>NgCompositeRules.MAX_REGEX_INPUT)return false;
            regexp.lastIndex=0;matched=regexp.test(text);regexp.lastIndex=0;
          }catch(_){known=false;matched=false;}
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
  static initialState(chat: NgCompositeInitialChat,videoId='') {
    const p=chat.props||chat;
    return {
      text:String(chat.text||''),cmd:String(chat.cmd||''),color:chat.color||'#FFFFFF',
      size:chat.size||'medium',type:chat.type||'naka',
      opacity:Number.isFinite(chat.opacity)?(chat.opacity as number):1,
      nicoru:chat.nicoru,nicoruKnown:chat.nicoruKnown!==undefined?chat.nicoruKnown:p.nicoruKnown,
      userId:chat.userId||'',fork:chat.fork,score:chat.score,vpos:chat.vpos,
      videoId:videoId||'',threadLabel:chat.threadLabel,isCA:chat.isCA
    };
  }
  static applyAction(rule: NgCompositeValidationRule,state: NgCompositeActionState,regexCache: Map<string,RegExp> | null=null): false | void {
    if(rule.action==='hide'||rule.action==='hideAuthor'){state.hidden=true;return;}
    if(rule.action==='mask'){state.text=rule.mask;return;}
    if(rule.action==='dim'){state.opacity*=rule.dim/100;return;}
    if(rule.action==='replace'){
      if(!rule.pattern){return;}
      if(rule.regexReplace){
        if(state.text.length>NgCompositeRules.MAX_REGEX_INPUT)return false;
        try{
          const key=JSON.stringify([rule.pattern,rule.flags]);
          let re=regexCache?.get(key);
          if(!re){
            if(!NgCompositeRules.isSafeRegex(rule.pattern,rule.flags))return false;
            re=new RegExp(rule.pattern,rule.flags);regexCache?.set(key,re);
          }
          re.lastIndex=0;
          const replaced=state.text.replace(re,rule.replacement);
          re.lastIndex=0;
          if(replaced.length>8192)return false;
          state.text=replaced;
        }catch(_){return false;}
      }else {
        if(state.text.length>8192)return false;
        const replaced=state.text.split(rule.pattern).join(rule.replacement);
        if(replaced.length>8192)return false;state.text=replaced;
      }
      return;
    }
    if(rule.action==='normalize'&&rule.normalizeColor==='keep'&&rule.normalizeSize==='keep')return;
    let tokens=state.cmd.split(/\s+/).filter(Boolean);
    let colorChanged=false,sizeChanged=false;
    if(rule.action==='strip'){
      const excluded=new Set(rule.strip.map(v=>v.toLowerCase()));
      const removed=tokens.filter(v=>excluded.has(v.toLowerCase()));
      if(!removed.length)return;
      colorChanged=removed.some(t=>Object.prototype.hasOwnProperty.call(
        NG_COLOR_HEX,t.toLowerCase())||/^#[a-f\d]{6}$/i.test(t));
      sizeChanged=removed.some(t=>['big','small'].includes(t.toLowerCase()));
      tokens=tokens.filter(v=>!excluded.has(v.toLowerCase()));
    }else if(rule.action==='normalize'){
      colorChanged=rule.normalizeColor!=='keep';
      sizeChanged=rule.normalizeSize!=='keep';
      if(colorChanged){
        tokens=tokens.filter(t=>!Object.prototype.hasOwnProperty.call(
          NG_COLOR_HEX,t.toLowerCase())&&!/^#[a-f\d]{6}$/i.test(t));
        if(rule.normalizeColor!=='white'){tokens.push(rule.normalizeColor);}
      }
      if(sizeChanged){
        tokens=tokens.filter(t=>!['big','small'].includes(t.toLowerCase()));
        if(rule.normalizeSize!=='medium'){tokens.push(rule.normalizeSize);}
      }
    }
    state.cmd=tokens.join(' ');
    if(colorChanged){state.color=NgCompositeRules.commandColor(state.cmd,'#FFFFFF');}
    if(sizeChanged){
      const lower=tokens.map(t=>t.toLowerCase());
      state.size=lower.includes('big')?'big':lower.includes('small')?'small':'medium';
    }
    // Preserve state.type: vertical group membership is owned by NicoComment.
  }
  static compile(input: unknown): NgCompositeProgram | null {
    if(NgCompositeRules._programs?.has(input as object))return input as NgCompositeProgram;
    let rules: NgCompositeValidationRule[];
    try{rules=JSON.parse(JSON.stringify(input));}catch(_){return null;}
    if(!NgCompositeRules.validate(rules))return null;
    const regexCache=new Map<string, RegExp>();
    const add=(source: string,flags: string)=>{
      const key=JSON.stringify([source,flags]);
      if(!regexCache.has(key))regexCache.set(key,new RegExp(source,flags));
    };
    const walk=(n: NgCompositeValidationNode): void=>{
      if(n.kind==='group')n.nodes.forEach(walk);
      else if(n.field==='regex'||n.cmp==='regex')add(n.value,'i');
    };
    for(const r of rules){walk(r.conditions);if(r.action==='replace'&&r.regexReplace)add(r.pattern,r.flags);}
    const freeze=(value: unknown): void=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
    freeze(rules);
    const active=rules.filter(r=>r.enabled);
    const program=Object.freeze({rules,active:Object.freeze(active),regexCache,
      before:Object.freeze(active.filter(r=>r.phase==='before')),
      after:Object.freeze(active.filter(r=>r.phase==='after')),
      hasAuthors:active.some(r=>r.action==='hideAuthor')});
    if(!NgCompositeRules._programs)NgCompositeRules._programs=new WeakSet();
    NgCompositeRules._programs.add(program);
    return program;
  }
  static project(chats: NgCompositeInitialChat[],rules: unknown,legacyPredicate: (state: NgCompositeProjectionState)=>boolean=()=>true,videoId='',baselines: Map<NgCompositeInitialChat,Record<string,unknown>> | null=null): Map<NgCompositeInitialChat,NgCompositeProjectionState> | null {
    return NgCompositeRules.projectWithMeta(chats,rules,legacyPredicate,videoId,baselines)?.results||null;
  }
  static projectWithMeta(chats: NgCompositeInitialChat[],rules: unknown,legacyPredicate: (state: NgCompositeProjectionState)=>boolean=()=>true,videoId='',baselines: Map<NgCompositeInitialChat,Record<string,unknown>> | null=null,seedBans: Map<string,Array<string|number>> | null=null): NgCompositeProjectionResult | null {
    const program=NgCompositeRules.compile(rules);
    if(!program||!program.active.length)return null;
    const rows=chats.map(chat=>{
      const live=NgCompositeRules.initialState(chat,videoId),old=baselines?.get(chat);
      if(old)for(const key of ['text','cmd','color','size','opacity'])(live as Record<string,unknown>)[key]=old[key];
      return {...live,hidden:false,visible:true,stopped:false,legacyRejected:false};
    });
    const authorMatches=new Map<string,Set<string|number>>();
    const eligible=(s: NgCompositeProjectionState,r: NgCompositeValidationRule)=>!s.hidden&&!s.stopped&&(r.phase==='before'||!s.legacyRejected);
    const phase=(rulesInPhase: readonly NgCompositeValidationRule[])=>{
      for(const r of rulesInPhase){
        if(r.action==='hideAuthor'){
          const ids=new Set(seedBans?.get(r.id)||[]);
          for(const s of rows){
            if(!eligible(s,r)||!s.userId||!NgCompositeRules.matchScope(r,s)||NgCompositeRules.protected(r,s))continue;
            if(NgCompositeRules.matches(r.conditions,s,program.regexCache))ids.add(s.userId);
          }
          authorMatches.set(r.id,ids);
          for(const s of rows){
            if(!eligible(s,r)||!s.userId||!ids.has(s.userId))continue;
            if(r.keepProtectedOnAuthorHide&&NgCompositeRules.protected(r,s))continue;
            s.hidden=true;s.stopped=true;
          }
        }else for(const s of rows){
          if(!eligible(s,r)||!NgCompositeRules.matchScope(r,s)||NgCompositeRules.protected(r,s))continue;
          if(!NgCompositeRules.matches(r.conditions,s,program.regexCache))continue;
          if(NgCompositeRules.applyAction(r,s,program.regexCache)===false)continue;
          if(r.stopOnMatch||s.hidden)s.stopped=true;
        }
      }
    };
    phase(program.before);
    for(const s of rows){
      // A before hide must not erase the cause of legacy author-wide NG.
      // Legacy matching observes the state reached by before transformations.
      s.legacyRejected=!legacyPredicate(s);
      s.visible=!s.hidden&&!s.legacyRejected;
    }
    phase(program.after);
    const results=new Map();
    rows.forEach((s,i)=>{s.visible=!s.hidden&&!s.legacyRejected;results.set(chats[i],s);});
    return {results,authorMatches};
  }
}
//===END===
export {NgCompositeRules};