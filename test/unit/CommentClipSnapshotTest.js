const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const {runtime, rule, chat} = require('../helpers/compositeTask403');

describe('Task1117 regional comment snapshots', () => {
  it('reads only the requested interval from a 20,000-comment sorted group', () => {
    const c = createContext({});
    run(beginSection('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js') +
      ';globalThis.Group=NicoChatGroupViewModel;', c);
    const group = Object.create(c.Group.prototype);
    let reads = 0;
    group._maxInViewDuration = 4;
    group._vSortedMembers = Array.from({length:20000}, (_, i) => ({
      no:i, get beginLeftTiming() { reads++; return i; }, endRightTiming:i+4
    }));
    const selected = group.getMembersInRange(16000, 16003);
    assert.deepStrictEqual(Array.from(selected, x => x.no), [15996,15997,15998,15999,16000,16001,16002,16003]);
    if (process.env.ZENZA_COMMENT_METRICS) console.log({regionalStartReads:reads, fullScan:group._vSortedMembers.length});
    assert(reads < 35, 'begin timing reads ' + reads);
  });
  it('examines each new arrival once during ordinary forward playback and restores the in-flight set after seek/layout', () => {
    const c = createContext({});
    run(beginSection('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js') +
      ';globalThis.Group=NicoChatGroupViewModel;', c);
    const group = Object.create(c.Group.prototype);
    let checks = 0, reference = 0, current = 0;
    group._maxInViewDuration = 4;
    group._lastUpdate = group._completedLayout = 1;
    group._vSortedMembers = Array.from({length:20000}, (_, i) => ({
      no:i, beginLeftTiming:i/100, endRightTiming:i/100+4,
      isInViewBySecond(t) { checks++; return t + 1 >= this.beginLeftTiming && t <= this.endRightTiming; }
    }));
    const cursor = {next:0};
    let previous = new Set();
    for (let i=0;i<100;i++) {
      const sec=50+i/10, newRows=[];
      checks = 0;
      const existing = group.getInViewMembersBySecond(sec);
      reference += checks;
      checks = 0;
      group.appendNewInViewMembers(sec,cursor,newRows);
      current += checks;
      assert.deepStrictEqual(newRows.map(c=>c.no), Array.from(existing).filter(c=>!previous.has(c)).map(c=>c.no));
      previous = new Set(existing);
    }
    if (process.env.ZENZA_COMMENT_METRICS) console.log({forwardVisibilityChecks:current, previous:reference});
    assert(current < reference / 25, 'visibility checks '+current+' vs '+reference);
    for(const sec of [12,12.1]) {
      if(sec===12.1)group._lastUpdate = group._completedLayout = 2;
      const newRows=[];
      group.appendNewInViewMembers(sec,cursor,newRows);
      assert.deepStrictEqual(newRows.map(c=>c.no),Array.from(group.getInViewMembersBySecond(sec),c=>c.no));
    }
  });
  it('admits the configured limit, protects owner and whole art groups, and retains history reserve', () => {
    const c = createContext({NicoChatViewModel:{SPEED_RATE:1},NicoChat:{SORT_FUNCTION:(a,b)=>a.no-b.no}});
    run(beginSection('packages/zenza/src/commentLayer/CommentDisplayBudget.js'), c);
    run(beginSection('src/ShareClipRenderer.js')+';globalThis.clip=ShareClipRenderer;',c);
    const chats = Array.from({length:500},(_,i)=>({no:i,type:'ue',isFixed:true,fork:0,beginLeftTiming:1,endRightTiming:4,
      text:'comment'+i,isInViewBySecond:()=>true}));
    const vm={getGroup:t=>({members:t==='ue'?chats:[]}),isHistoryChat:c=>c.no<400};
    chats[0].fork=1;
    const snapshot = c.clip.captureComments(vm,1,2,400);
    const shown=Array.from(snapshot.getGroup('ue').members, row=>row.no);
    assert.equal(shown.length,301);
    assert(shown.includes(0) && shown.includes(499));
    assert.equal(shown.filter(no=>no>=400).length,100);
    chats.forEach(row=>{row.isMine = false;row.fork = 0;});
    vm.isHistoryChat=()=>false;
    chats[39].commentArtGroup=chats[40].commentArtGroup='art';
    const capped=Array.from(c.clip.captureComments(vm,1,2,40).getGroup('ue').members,row=>row.no);
    assert.equal(capped.length,40);
    assert(!capped.includes(39) && !capped.includes(40));
  });
  it('rejects a pending clip when its source group is replaced before layout completes', async () => {
    const c = createContext({setTimeout});
    run(beginSection('src/ShareClipRenderer.js')+';globalThis.clip=ShareClipRenderer;',c);
    const group={clipLayoutReady:false,_nicoChatGroup:{_members:[]},members:[]};
    const pending=c.clip.prepareComments({getGroup:()=>group},1,2,400);
    group._nicoChatGroup._members=[];
    group.clipLayoutReady=true;
    await assert.rejects(pending,/切り替わりました/);
  });
  it('prepares history author NG across all groups without altering the live set until commit', () => {
    const h = runtime('source',[rule('hideAuthor')]);
    const old = chat(1,'ordinary','A','ue'), cause = chat(2,'BAN','A');
    h.model.addChat(old);
    const stage = h.filter.prepareHistoryPool([old,cause]);
    assert.deepStrictEqual(Array.from(stage.filter([old])), []);
    assert.deepStrictEqual(Array.from(h.groups[0].members), [old]);
    assert(!h.filter._compositePool.has(cause));
    stage.commit();
    assert.deepStrictEqual(Array.from(h.filter.applyFilter([old])), []);
    h.filter.prepareHistoryPool([old]).commit();
    assert.deepStrictEqual(Array.from(h.filter.applyFilter([old])), [old]);
    assert(!h.filter._compositePool.has(cause));
  });
});
