import assert from 'power-assert';
const {beginSection,createContext,run}=require('../helpers/extractSource');
function subject(){
  const NicoChat={TYPE:{TOP:'ue',NAKA:'naka',BOTTOM:'shita'},SIZE:{BIG:'big',MEDIUM:'medium',SMALL:'small'}};
  const c=createContext({NicoChat,Config:{props:{baseChatScale:1},onkey(){}},
    CommentLayer:{SCREEN:{WIDTH:544,HEIGHT:384,WIDTH_INNER:512,WIDTH_FULL_INNER:640,WIDTH_FULL_INNER_HTML5:684}},
    NicoTextParser:{likeXP:String,likeHTML5:String}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  const Cls=run(beginSection('packages/zenza/src/commentLayer/NicoChatViewModel.js')+';NicoChatViewModel;',c);
  const create=(rate,type,commentVer,duration=4,lines=1,width=180)=>{
    Cls.SPEED_RATE=rate;
    const chat={id:'test',type,commentVer,size:'medium',vpos:3000,duration,text:'test',htmlText:Array(lines).fill('test').join('<br>')};
    const field={setText(){},setFontSizePixel(){},setType(){},getOriginalWidth:()=>width,getOriginalHeight:()=>lines*32};
    return Cls.create(chat,{getTextField:()=>field});
  };
  return {create};
}
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-9,label+': '+a+' / '+b);
describe('保存速度で初期化したコメントの表示時間（H-02 / Task111）',function(){
  for(const ver of ['flash','html5'])for(const type of ['naka','ue','shita']){
    it(ver+'/'+type+'は読込時と速度変更時で同じ時間・速度・衝突範囲になる',function(){
      const {create}=subject();
      for(const rate of [0.5,1,2])for(const duration of [4,120])for(const [lines,width]of [[1,180],[10,900]]){
        const initial=create(rate,type,ver,duration,lines,width);
        const changed=create(1,type,ver,duration,lines,width);changed.recalcBeginEndTiming(rate);
        for(const key of ['duration','speed','beginLeftTiming','beginRightTiming','endLeftTiming','endRightTiming'])close(initial[key],changed[key],key);
        close(initial.endRightTiming-initial.beginLeftTiming,duration/rate,'lifetime');
        for(const key of ['beginLeft','beginRight','endLeft','endRight'])close(initial.bulkLayoutData[key],changed.bulkLayoutData[key],key);
        initial.isLayouted=true;
        const end=initial.beginLeftTiming+duration/rate;
        assert.equal(initial.isInViewBySecond(end-0.001),true);assert.equal(initial.isInViewBySecond(end+0.001),false);
        if(type==='naka')close(544-(end-initial.beginLeftTiming)*initial.speed,-initial.width,'movement over lifetime');
      }
    });
  }
});
