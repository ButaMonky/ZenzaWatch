export const externalDefaults = {
  'externalLinks.enabled': true,
  'externalLinks.siteMode': 'all',
  'externalLinks.sites': '',
  'externalLinks.excludedSites': '',
  'externalLinks.activation': 'hover',
  'externalLinks.size': 'small',
  'externalLinks.redirects': false,
  'externalLinks.textIds': false,
  'externalLinks.prefixes': 'sm nm so ss'
};
export type ExternalKey = keyof typeof externalDefaults;
export interface ExternalSettings { enabled:boolean; siteMode:string; sites:string[]; excludedSites:string[]; activation:string; size:string; redirects:boolean; textIds:boolean; prefixes:string[]; }
export interface Descriptor {id:ExternalKey; label:string; type:string; category:string; subcategory:string; description?:string; dependsOn?:string; options?:{value:string;label:string}[];}
const choice=(items:[string,string][])=>items.map(([value,label])=>({value,label}));
export const externalDescriptors:Descriptor[] = [
 {id:'externalLinks.enabled',label:'外部サイトでZenボタンを使う',type:'boolean'},
 {id:'externalLinks.siteMode',label:'対象サイト',type:'select',options:choice([['all','すべてのサイト'],['allow','指定したサイトのみ']])},
 {id:'externalLinks.sites',label:'対象のドメイン',type:'text',description:'例：example.com。空白・改行・カンマで区切ります。サブドメインも含みます。'},
 {id:'externalLinks.excludedSites',label:'除外するドメイン',type:'text',description:'除外を優先します。URLではなくドメインを入力してください。'},
 {id:'externalLinks.activation',label:'ボタンを表示するタイミング',type:'select',options:choice([['hover','マウスを置いたとき・キーボードでフォーカスしたとき'],['selection','文字を選択したとき']])},
 {id:'externalLinks.size',label:'ボタンの大きさ',type:'select',options:choice([['small','小'],['normal','標準'],['large','大']])},
 {id:'externalLinks.redirects',label:'中継リンク内の動画URLも検出',type:'boolean',description:'リンクを開かず、埋め込まれたニコニコ動画URLを調べます。'},
 {id:'externalLinks.textIds',label:'文章中の動画IDも検出',type:'boolean',description:'入力欄・編集中・コード欄は対象外です。'},
 {id:'externalLinks.prefixes',label:'検出する動画IDの接頭辞',type:'text',description:'例：sm nm so ss。英小文字2〜8文字を空白で区切ります。再生可能かの事前通信はしません。'}
].map(d=>({...d,category:'プレイリスト・検索',subcategory:'外部サイトからの再生',dependsOn:d.id==='externalLinks.enabled'?undefined:'externalLinks.enabled'})) as Descriptor[];
const tokens=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase().split(/[\s,]+/).filter(Boolean):[];
const domains=(v:unknown)=>tokens(v).filter(x=>/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/.test(x));
export function sanitizeExternal(values:unknown):Record<ExternalKey,string|boolean> {
 const source=values&&typeof values==='object'?values as Record<string,unknown>:{};
 const out={...externalDefaults} as Record<ExternalKey,string|boolean>;
 for(const key of Object.keys(out) as ExternalKey[]){
  const value=source[key];
  if(typeof value===typeof out[key])out[key]=typeof value==='string'?value.slice(0,4096):value as boolean;
 }
 for(const [key,valid] of [['externalLinks.siteMode',['all','allow']],['externalLinks.activation',['hover','selection']],['externalLinks.size',['small','normal','large']]] as [ExternalKey,string[]][])
  if(!valid.includes(String(out[key])))out[key]=externalDefaults[key];
 return out;
}
export function readExternal(values:unknown):ExternalSettings {
 const v=sanitizeExternal(values);
 return {enabled:v['externalLinks.enabled']===true,siteMode:String(v['externalLinks.siteMode']),sites:domains(v['externalLinks.sites']),excludedSites:domains(v['externalLinks.excludedSites']),activation:String(v['externalLinks.activation']),size:String(v['externalLinks.size']),redirects:v['externalLinks.redirects']===true,textIds:v['externalLinks.textIds']===true,prefixes:[...new Set(tokens(v['externalLinks.prefixes']).filter(x=>/^[a-z]{2,8}$/.test(x)))]};
}
export function siteEnabled(host:string,s:ExternalSettings):boolean {
 const matches=(domain:string)=>host===domain||host.endsWith('.'+domain);
 return s.enabled&&!s.excludedSites.some(matches)&&(s.siteMode==='all'||s.sites.some(matches));
}
