const assert=require('assert');
const {loadClass,createContext,beginSection,run,read}=require('../helpers/extractSource');
function subject(){const config={props:{'commentLayer.protectCA':true}},ctx=createContext({Config:config});run(beginSection('packages/zenza/src/commentLayer/CommentArtProtection.js')+';globalThis.CommentArtProtection=CommentArtProtection;',ctx);const VM=loadClass('packages/zenza/src/commentLayer/NicoChatViewModel.js','NicoChatViewModel',ctx);return {VM,config};}
const chat=no=>Object.freeze({id:no,no,threadId:'10',fork:0,layerId:0,userId:'synthetic',date:1700000000+no,text:'part',cmd:'ue full ender',vpos:100,type:'ue'});
describe('Task211 CA metadata is shared by normal and history view models',()=>{
 it('overrides collision metadata only, and OFF restores original layers',()=>{const h=subject();assert.strictEqual(typeof h.VM.prepareCommentArt,'function');const a=Object.create(h.VM.prototype),b=Object.create(h.VM.prototype);a._nicoChat=chat(1);b._nicoChat=chat(2);let resets=0;for(const v of [a,b])v.resetLayoutForSpeedChange=()=>{resets++;};h.VM.prepareCommentArt([a,b]);assert.strictEqual(a.layerId,b.layerId);assert.notStrictEqual(a.layerId,0);assert.strictEqual(a._nicoChat.layerId,0);assert.strictEqual(a.commentArtGroup,b.commentArtGroup);assert.strictEqual(resets,2);h.config.props['commentLayer.protectCA']=false;h.VM.prepareCommentArt([a,b]);assert.strictEqual(a.layerId,0);assert.strictEqual(a.commentArtGroup,null);assert.strictEqual(resets,4);});
 it('does not reset unchanged metadata repeatedly',()=>{const h=subject();assert.strictEqual(typeof h.VM.prepareCommentArt,'function');const a=Object.create(h.VM.prototype),b=Object.create(h.VM.prototype);a._nicoChat=chat(1);b._nicoChat=chat(2);let n=0;for(const v of [a,b])v.resetLayoutForSpeedChange=()=>n++;h.VM.prepareCommentArt([a,b]);h.VM.prepareCommentArt([a,b]);assert.strictEqual(n,2);});
 it('sends prepared comment-art groups with the layout request', async () => {
   const {VM} = subject();
   const ctx = createContext({NicoChatViewModel: VM, NicoChat: {SORT_FUNCTION: (a,b) => a.id-b.id}});
   const Group = loadClass('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js', 'NicoChatGroupViewModel', ctx);
   const group = Object.create(Group.prototype);
   group._lastUpdate = 0;
   group._members = [2,1].map(id => ({
     id, type: 'ue', _nicoChat: chat(id), resetLayoutForSpeedChange() {},
     get bulkLayoutData() { return {id, group: this._commentArtMetadata?.group}; },
     set bulkLayoutData(value) { this.reply = value; }
   }));
   let request;
   group._layoutWorker = {post: async ({params}) => {
     request = params;
     return {lastUpdate: params.lastUpdate, members: params.members.map(m => ({id:m.id, ypos:0, isOverflow:false}))};
   }};
   assert.strictEqual(await group._execCommentLayoutWorker(), true);
   assert.deepStrictEqual(Array.from(request.members, m => m.id), [1,2]);
   const [first, second] = request.members;
   assert.ok(first.group);
   assert.strictEqual(first.group, second.group);
 });
 it('history layout uses the identical VM helper before sorting and layout',()=>{const s=read('packages/comment-history/src/renderer.mjs');assert(s.includes('this.#VM.prepareCommentArt'));assert(s.indexOf('this.#VM.prepareCommentArt')<s.indexOf('const sorted=entry.sorted'));});
 it('actual renderer passes group metadata into the finite budget, not a bypass',()=>{const s=read('packages/zenza/src/commentLayer/NicoCommentCss3PlayerView.js');assert(s.includes('groupOf:'));assert(s.includes('commentArtGroup'));});
 it('exposes a boolean advanced switch without modifying the comment-history panel',()=>{assert(read('src/Config.js').includes("'commentLayer.protectCA': true"));assert(read('src/_setting.js').includes('data-setting-name="commentLayer.protectCA"'));assert(!read('packages/comment-history/src/panel.mjs').includes('data-setting-name="commentLayer.protectCA"'));});
});

describe('Task211 no-op for ordinary geometry',()=>{it('does not reset an ordinary-only group on its first classification',()=>{const h=subject(),v=Object.create(h.VM.prototype);v._nicoChat=Object.freeze({...chat(1),cmd:'',text:'ordinary'});let resets=0;v.resetLayoutForSpeedChange=()=>resets++;assert.strictEqual(h.VM.prepareCommentArt([v]),false);assert.strictEqual(resets,0);});});
