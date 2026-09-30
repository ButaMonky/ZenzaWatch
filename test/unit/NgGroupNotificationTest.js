const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function context() {
  const logger = {log() {}, time() {}, timeEnd() {}};
  const c = createContext({console: logger, _: {compact: xs => xs.filter(Boolean), debounce: fn => fn},
    Config: {getValue: () => false}, textUtil: {escapeRegs: s => s}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'), c);
  run(`function chat(no, text = 'clean', userId = 'user-' + no, fork = 0) {
    return {no, text, userId, fork, threadId: 1, threadLabel: 'default', type: 'naka', score: 0, cmd: ''};
  }`, c);
  return c;
}

function setup() {
  const c=context();
  run(beginSection('packages/zenza/src/commentLayer/NicoChatGroup.js'),c);
  run(`globalThis.filter=new NicoChatFilter({wordFilter:'blocked',removeNgMatchedUser:true});
    globalThis.group=new NicoChatGroup('naka',{nicoChatFilter:filter});
    globalThis.visible=[];globalThis.events=[];
    group.on('change',()=>{visible=group.members.slice();events.push('change');});
    group.on('addChat',chat=>{visible.push(chat);events.push('addChat');});
    group.on('addChatArray',chats=>{visible.push(...chats);events.push('addChatArray');});`,c);
  return c;
}
function view(c,expected){
  assert.deepStrictEqual(Array.from(c.visible,x=>x.no),expected);
  assert.deepStrictEqual(Array.from(run('group.members',c),x=>x.no),expected);
}
describe('NG matched-user group notifications',()=>{
  it('late NG trigger hides an earlier clean comment by the same user',()=>{
    const c=setup();run("group.addChat(chat(1,'clean','same'));",c);view(c,[1]);
    run("events.length=0;group.addChatArray([]);",c);view(c,[1]);
    assert.strictEqual(c.events.length,0,'empty array additions stay silent');
    run("events.length=0;group.addChat(chat(2,'blocked','same'));",c);view(c,[]);
    assert.deepStrictEqual(Array.from(c.events),['change']);
  });
  it('new single and array comments from an already excluded user do not leak',()=>{
    const c=setup();run("group.addChatArray([chat(1,'blocked','same')]);group.addChat(chat(2,'clean','same'));",c);view(c,[]);
    run("group.addChatArray([chat(3,'clean','same'),chat(4,'clean','other')]);",c);view(c,[4]);
  });
  it('removing the hidden trigger restores older comments and ignores nonexistent removal',()=>{
    const c=setup();run("group.addChatArray([chat(1,'clean','same'),chat(2,'blocked','same')]);",c);view(c,[]);
    run("events.length=0;group.removeChat(chat(2,'blocked','same'));",c);view(c,[1]);
    assert.deepStrictEqual(Array.from(c.events),['change']);
    run("events.length=0;group.removeChat(chat(999));",c);view(c,[1]);
    assert.strictEqual(c.events.length,0);
  });
  it('ordinary filtering keeps incremental additions when matched-user removal is disabled',()=>{
    const c=setup();run("filter.removeNgMatchedUser=false;events.length=0;group.addChat(chat(1));group.addChatArray([chat(2)]);",c);view(c,[1,2]);
    assert.deepStrictEqual(Array.from(c.events),['addChat','addChatArray']);
  });
});
