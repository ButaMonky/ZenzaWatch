import {NgCompositeRules} from './NgCompositeRules';
//===BEGIN===
class NgCompositeRuleEditor {
  constructor(host,saved,onChange){
    this.host=host;
    this.onChange=onChange;
    this.doc=host.ownerDocument;
    this.shadow=host.shadowRoot||host.attachShadow({mode:'open'});
    this.rules=NgCompositeRuleEditor.copy(saved);
    this.selected=this.rules[0]?.id||'';
    this.serial=0;
    this.sample={text:'中国の話ｗｗｗ',cmd:'red big ue',userId:'nvc:sample',nicoru:0,score:0,vpos:1500,videoId:'sm9',fork:0};
    this._makeFrame();
    this.render();
  }
  static copy(v){return JSON.parse(JSON.stringify(v||[]));}
  static get fields(){return [['text','本文（部分一致）'],['regex','本文（正規表現）'],
    ['cmd','コマンド文字列'],['color','コマンド文字色'],['size','文字サイズ'],
    ['user','ユーザーID'],['nicoru','ニコる数'],['position','表示位置'],
    ['fork','コメント種別'],['score','NG共有スコア'],['vpos','動画内秒数'],['video','動画ID']];}
  static get colors(){return [['white','白'],['red','赤'],['pink','ピンク'],['orange','オレンジ'],
    ['yellow','黄'],['green','緑'],['cyan','水色'],['blue','青'],['purple','紫'],
    ['black','黒'],['white2','ニコニコホワイト'],['niconicowhite','ニコニコホワイト（別名）'],
    ['red2','濃い赤'],['truered','濃い赤（別名）'],['pink2','ピンク2'],
    ['orange2','オレンジ2'],['passionorange','パッションオレンジ'],['yellow2','濃い黄'],
    ['madyellow','濃い黄（別名）'],['green2','深緑'],['elementalgreen','深緑（別名）'],
    ['cyan2','濃い水色'],['blue2','明るい青'],['marineblue','明るい青（別名）'],
    ['purple2','濃い紫'],['nobleviolet','濃い紫（別名）'],['black2','灰色']];}
  static newRule(){
    const id=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,9);
    return {id:id(),name:'新しい複合ルール',enabled:false,scope:'normal',
      phase:'after',stopOnMatch:true,conditions:{id:id(),kind:'group',mode:'all',
        nodes:[{id:id(),field:'text',cmp:'contains',value:'',not:false}]},
      exemptNicoru:false,nicoruMin:1,unknownPolicy:'evaluate',keepProtectedOnAuthorHide:true,
      action:'hide',pattern:'',replacement:'',regexReplace:false,flags:'g',
      strip:['red','big'],normalizeColor:'white',normalizeSize:'medium',dim:30,mask:'［置換済み］'};
  }
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  opt(options,value){return options.map(([id,label])=>
    '<option value="'+this.esc(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+this.esc(label)+'</option>').join('');}
  colorSelect(current,key){
    const pairs=[['keep','変更しない'],...NgCompositeRuleEditor.colors];
    const items=key==='normalizeColor'?pairs:NgCompositeRuleEditor.colors;
    return '<span class="ng-color"><span class="ng-dot" style="background:'+
      this.esc(NgCompositeRules.COLORS[current]||'#8493a4')+'"></span><select data-'+
      (key==='normalizeColor'?'rule':'node-value')+'="'+this.esc(key==='normalizeColor'?key:key)+'">'+
      this.opt(items.map(([id,name])=>[id,'● '+name+'（'+id+' / '+(NgCompositeRules.COLORS[id]||'')+'）']),current)+
      '</select></span>';
  }
  current(){return this.rules.find(x=>x.id===this.selected)||null;}
  find(id,node=this.current()?.conditions){
    if(!node)return null;
    if(node.id===id)return node;
    for(const child of node.nodes||[]){const v=this.find(id,child);if(v)return v;}
    return null;
  }
  parent(id,node=this.current()?.conditions){
    if(!node||!node.nodes)return null;
    for(const child of node.nodes){
      if(child.id===id)return node;
      const inner=this.parent(id,child);if(inner)return inner;
    }
    return null;
  }
  _makeFrame(){
    const style=this.doc.createElement('style');
    style.textContent=`
      :host{display:block;min-width:0;max-width:100%;font:13px/1.5 system-ui,"Yu Gothic",Meiryo,sans-serif;color:#edf4ff}
      *,*::before,*::after{box-sizing:border-box}button,input,select,textarea{font:inherit}
      button{cursor:pointer;color:#edf4ff;background:#22354a;border:1px solid #4e6989;border-radius:5px;padding:6px 9px}
      button:hover{border-color:#90c5fc}button:disabled{opacity:.48;cursor:default}
      input[type=text],input[type=number],select,textarea{max-width:100%;min-width:0;background:#101927;border:1px solid #435c7a;border-radius:5px;color:#edf4ff;padding:7px}
      input[type=checkbox]{appearance:checkbox;-webkit-appearance:checkbox;width:17px;height:17px;accent-color:#82bfff;vertical-align:middle;margin:0}
      [hidden]{display:none!important}
      h4{font-size:15px;margin:0 0 10px}p{margin:6px 0 10px}.ng-sub{color:#acbfd2;font-size:12px}
      .ng-box{background:#233449;border:1px solid #39506b;border-radius:5px;padding:13px;margin:0 0 12px}
      .ng-help summary{cursor:pointer;color:#a6ceff;font-weight:650}
      .ng-help details{margin:12px 0 6px}.ng-help p{line-height:1.75;padding:3px}
      .ng-layout{display:grid;grid-template-columns:minmax(200px,31%) minmax(0,1fr);gap:12px;min-width:0}
      .ng-side{background:#132136;border:1px solid #38516b;border-radius:5px;padding:12px;min-width:0}
      .ng-list{display:grid;gap:6px;margin:10px 0}.ng-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .ng-rule{display:flex;align-items:center;gap:4px;border:1px solid #45617f;border-radius:5px;padding:6px;margin:7px 0}
      .ng-rule.selected{border-color:#92c5ff;background:#2b4360}
      .ng-rule .ng-pick{flex:1;min-width:95px;text-align:left;overflow-wrap:anywhere}
      .ng-rule small{display:block;color:#abc4d9}.ng-rule button{padding:4px 6px}
      .ng-field{display:grid;gap:4px;margin:7px 0}.ng-flex{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0}
      .ng-flex label{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
      .ng-wide{flex:1;min-width:155px}.ng-wide input{width:100%}
      .ng-group{margin:8px 0;border-left:3px solid #7baddf;padding:8px;background:#14263b}
      .ng-condition{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:8px 0;padding:7px;border:1px solid #47627d;border-radius:5px;background:#253950}
      .ng-condition select,.ng-condition input{flex:1 1 120px}.ng-condition label{display:inline-flex;align-items:center;gap:5px}
      .ng-group-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ng-group-head strong{flex:1}
      .ng-color{display:inline-flex;align-items:center;gap:6px;flex:1 1 180px}
      .ng-dot{width:18px;height:18px;border-radius:50%;border:1px solid #8290a5;flex:none}
      .ng-color select{flex:1;min-width:100px}
      .ng-preview{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .ng-preview article{background:#101d2d;padding:12px;border:1px solid #425c79;border-radius:5px;min-height:73px}
      .ng-preview p{white-space:pre-wrap;overflow-wrap:anywhere}
      .ng-error{color:#ffc986}.ng-ok{color:#9ed8bf}
      @media(max-width:980px){.ng-layout{grid-template-columns:1fr}.ng-side{max-height:400px;overflow:auto}}
      @media(max-width:550px){.ng-preview{grid-template-columns:1fr}}
    `;
    const el=this.doc.createElement('div');
    el.className='ng-root';
    el.innerHTML='<h4>複合NGルール（上級者向け）</h4>'+
      '<p class="ng-sub">複数条件でコメントの非表示・置換・装飾解除を設定できます。変更は画面下部で保存するまで反映しません。</p>'+
      this.helpHtml()+
      '<div class="ng-layout"><aside class="ng-side"><strong>ルール一覧（ドラッグ・上下移動可）</strong>'+
      '<div data-ng-list class="ng-list"></div><button data-ng-act="add">＋新規ルール</button> '+
      '<button data-ng-act="duplicate">選択ルールを複製</button></aside>'+
      '<div><section class="ng-box" data-ng-detail></section>'+
      '<section class="ng-box"><h4>プレビュー（下書きのまま試せます）</h4><div data-ng-sample></div>'+
      '<div data-ng-result></div></section></div></div>';
    this.shadow.replaceChildren(style,el);
    this.root=el;
    el.addEventListener('click',e=>this.click(e));
    el.addEventListener('input',e=>this.input(e));
    el.addEventListener('change',e=>this.input(e));
    el.addEventListener('dragstart',e=>{const row=e.target.closest('[data-ng-drag]');if(row)this.dragId=row.dataset.ngDrag;});
    el.addEventListener('dragover',e=>{if(this.dragId&&e.target.closest('[data-ng-drag]'))e.preventDefault();});
    el.addEventListener('drop',e=>{
      const row=e.target.closest('[data-ng-drag]');if(!row||!this.dragId)return;
      e.preventDefault();this.move(this.dragId,row.dataset.ngDrag);this.dragId=null;
    });
  }
  helpHtml(){
    return '<details class="ng-box ng-help"><summary>はじめて使う方へ：3つの手順（クリックで詳しく表示）</summary>'+
      '<p><b>1．ルールを追加：</b>「＋新規ルール」で作成し、名前を付けます。新規ルールは最初は無効なので、条件と処理を確認したあとに有効にします。</p>'+
      '<p><b>2．条件を指定：</b>「＋条件」で本文、色、文字サイズ、ユーザーID、ニコる数などを指定します。ANDならすべて、ORならどれかに一致すれば対象です。「＋グループ」で条件をまとめられます。</p>'+
      '<p><b>3．一致したときの処理：</b>非表示、投稿者全コメントを非表示、本文置換、装飾解除などを選びます。ニコる優先保護も設定でき、最後にプレビューと保存を行います。</p>'+
      '<details><summary>AND・OR・NOT・保護についてさらに詳しく</summary>'+
      '<p><b>AND：</b>「中国」を含む＋「赤文字」＋「big」なら3条件すべてが必要です。<b>OR：</b>どれか1つで一致します。</p>'+
      '<p><b>NOT：</b>その条件だけを反転します。OR内の別条件に一致することがあるため、全ルールからの保護にはなりません。</p>'+
      '<p><b>ニコる数で優先保護：</b>ニコるが指定数以上なら、そのルールをスキップします。保護する数の初期値は1件です。未取得なら通常判定かスキップを選べます。</p>'+
      '<p><b>投稿者一括NG：</b>一致した投稿者IDの同一動画中のコメントをまとめて非表示にします。永続NGユーザーIDには登録しません。</p>'+
      '<p><b>既存NGとの関係：</b>従来のNGワード・NGユーザー・共有NGは引き続き有効です。複合ルールの保護は従来のNGを解除しません。</p>'+
      '<p><b>正規表現と安全性：</b>多数のコメントに適用されるため、複雑すぎる正規表現には制限があります。元の投稿データは変更しません。</p></details></details>';
  }

  ruleList(){
    const target=this.root.querySelector('[data-ng-list]');
    target.innerHTML=this.rules.length?this.rules.map((r,i)=>
      '<div class="ng-rule'+(r.id===this.selected?' selected':'')+'" draggable="true" data-ng-drag="'+this.esc(r.id)+'">'+
      '<button class="ng-pick" data-ng-act="select" data-id="'+this.esc(r.id)+'">'+this.esc(r.name||'（無題）')+
      '<small>'+(r.enabled?'有効':'無効')+' / '+this.esc(r.action)+'</small></button>'+
      '<button data-ng-act="up" data-id="'+this.esc(r.id)+'"'+(i===0?' disabled':'')+'>↑</button>'+
      '<button data-ng-act="down" data-id="'+this.esc(r.id)+'"'+(i===this.rules.length-1?' disabled':'')+'>↓</button></div>').join(''):
      '<p class="ng-sub">まだルールはありません。左下の「＋新規ルール」から作成してください。</p>';
  }
  conditionHtml(c){
    const f=c.field;
    const num=['nicoru','score','vpos'].includes(f);
    const op=num?[['equals','＝'],['gte','以上'],['lte','以下']]:
      [['contains','含む'],['equals','一致する'],['notEquals','一致しない'],
       ['starts','先頭一致'],['ends','末尾一致'],['regex','正規表現']];
    const select=f==='color'?this.colorSelect(c.value,c.id):
      f==='size'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['big','大文字（big）'],['medium','標準'],['small','小文字（small）']],c.value)+'</select>':
      f==='position'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['ue','上固定'],['naka','通常（流れる）'],['shita','下固定']],c.value)+'</select>':
      f==='fork'?'<select data-node-value="'+this.esc(c.id)+'">'+this.opt([['normal','通常'],['owner','投稿者'],['easy','かんたん'],['other','その他']],c.value)+'</select>':
      '<input type="'+(num?'number':'text')+'" data-node-value="'+this.esc(c.id)+'" value="'+this.esc(c.value)+'" placeholder="'+(num?'0':'入力してください')+'">';
    return '<div class="ng-condition"><label><input type="checkbox" data-node-not="'+this.esc(c.id)+'"'+(c.not?' checked':'')+'>NOT</label>'+
      '<select data-node-field="'+this.esc(c.id)+'">'+this.opt(NgCompositeRuleEditor.fields,f)+'</select>'+
      '<select data-node-cmp="'+this.esc(c.id)+'">'+this.opt(op,c.cmp)+'</select>'+
      select+'<button data-ng-act="remove-node" data-id="'+this.esc(c.id)+'" title="削除">×</button></div>';
  }
  groupHtml(g,depth=0){
    let html='<div class="ng-group"><div class="ng-group-head"><strong>'+(depth?'条件グループ':'全体の条件')+'</strong>'+
      '<select data-group-mode="'+this.esc(g.id)+'">'+this.opt([['all','AND／すべて'],['any','OR／どれか']],g.mode)+'</select>'+
      '<button data-ng-act="add-node" data-parent="'+this.esc(g.id)+'">＋条件</button>'+
      '<button data-ng-act="add-group" data-parent="'+this.esc(g.id)+'"'+(depth>=2?' disabled':'')+'>＋グループ</button></div>';
    for(const node of g.nodes){
      html+=node.kind==='group'?this.groupHtml(node,depth+1):this.conditionHtml(node);
    }
    return html+'</div>';
  }
  detail(){
    const area=this.root.querySelector('[data-ng-detail]'),r=this.current();
    if(!r){area.innerHTML='<p>左の「＋新規ルール」を押して開始してください。</p>';return;}
    const chk=k=>r[k]?' checked':'';
    const actions=[['hide','コメントを非表示'],['hideAuthor','NG一致投稿者のコメントをすべて非表示'],
      ['replace','本文の置換'],['mask','本文を別の文字列にする'],['strip','指定されたコマンドを解除'],
      ['normalize','色・大きさを標準化'],['dim','薄く表示する']];
    let extra='';
    if(r.action==='replace')extra='<div class="ng-flex"><label class="ng-wide">検索文字列<input type="text" data-rule="pattern" value="'+this.esc(r.pattern)+'"></label>'+
      '<label class="ng-wide">置換後の文字<input type="text" data-rule="replacement" value="'+this.esc(r.replacement)+'"></label></div>'+
      '<div class="ng-flex"><label><input type="checkbox" data-rule="regexReplace"'+chk('regexReplace')+'>正規表現で置換</label>'+
      '<label>フラグ<input type="text" data-rule="flags" value="'+this.esc(r.flags)+'" style="width:80px"></label></div>';
    if(r.action==='mask')extra='<label class="ng-wide">置換する本文<input type="text" data-rule="mask" value="'+this.esc(r.mask)+'"></label>';
    if(r.action==='strip')extra='<label class="ng-wide">解除するコマンド（カンマで区切る）<input type="text" data-rule="strip" value="'+this.esc(r.strip.join(', '))+'"></label>'+
      '<p class="ng-sub">例：red, big（色とサイズを解除して位置指定は保持）</p>';
    if(r.action==='normalize')extra='<div class="ng-flex"><label>色を選ぶ'+this.colorSelect(r.normalizeColor,'normalizeColor')+'</label>'+
      '<label>文字サイズ<select data-rule="normalizeSize">'+this.opt([['keep','変更しない'],['medium','標準'],['big','big'],['small','small']],r.normalizeSize)+'</select></label></div>';
    if(r.action==='dim')extra='<label>表示透明度<input type="number" data-rule="dim" min="5" max="100" value="'+this.esc(r.dim)+'">％</label>';
    area.innerHTML='<h4>ルールの編集</h4>'+
      '<div class="ng-flex"><label class="ng-wide">名前<input data-rule="name" type="text" value="'+this.esc(r.name)+'"></label>'+
      '<label><input type="checkbox" data-rule="enabled"'+chk('enabled')+'>ルールを有効にする</label></div>'+
      '<div class="ng-flex"><label>対象<select data-rule="scope">'+this.opt([['normal','通常コメント'],['any','すべて'],['owner','投稿者コメント'],['easy','かんたんコメント']],r.scope)+'</select></label>'+
      '<label>適用順<select data-rule="phase">'+this.opt([['after','従来のNGより後'],['before','従来のNGより前']],r.phase)+'</select></label></div>'+
      '<div class="ng-box"><h4>一致条件</h4>'+this.groupHtml(r.conditions)+'</div>'+
      '<div class="ng-box"><h4>ニコる数による優先保護（NG除外）</h4>'+
      '<div class="ng-flex"><label><input type="checkbox" data-rule="exemptNicoru"'+chk('exemptNicoru')+'>指定数以上ならこのルールを適用しない</label></div>'+
      '<div class="ng-flex"><label>保護するニコる数<input type="number" min="1" max="10000000" data-rule="nicoruMin" value="'+this.esc(r.nicoruMin)+'">件以上</label>'+
      '<label>未取得の場合<select data-rule="unknownPolicy">'+this.opt([['evaluate','通常どおり判定'],['skip','このルールをスキップ']],r.unknownPolicy)+'</select></label></div>'+
      '<p class="ng-sub">ORでも優先保護を適用できます。従来のNGからは保護しません。</p></div>'+
      '<div class="ng-box"><h4>一致したときの動作</h4>'+
      '<label>動作<select data-rule="action">'+this.opt(actions,r.action)+'</select></label>'+
      '<div class="ng-flex">'+extra+'</div>'+
      (r.action==='hideAuthor'?'<label><input type="checkbox" data-rule="keepProtectedOnAuthorHide"'+chk('keepProtectedOnAuthorHide')+'>同じ投稿者でもニコる保護コメントは残す</label><p class="ng-sub">現在の動画内だけ。恒久NGユーザーIDには追加しません。</p>':'')+
      '<div class="ng-flex"><label><input type="checkbox" data-rule="stopOnMatch"'+chk('stopOnMatch')+'>一致後は後続のルールを適用しない</label></div></div>'+
      '<button data-ng-act="delete">選択ルールを削除</button>'+
      (!NgCompositeRules.validate(this.rules)?'<p class="ng-error">入力途中または不正な条件があります。保存前に確認してください。</p>':'');
  }
  demoFields(){
    this.root.querySelector('[data-ng-sample]').innerHTML='<div class="ng-flex">'+
      '<label class="ng-wide">サンプル本文<input type="text" data-example="text" value="'+this.esc(this.sample.text)+'"></label>'+
      '<label>コマンド<input type="text" data-example="cmd" value="'+this.esc(this.sample.cmd)+'"></label>'+
      '<label>ニコる数<input type="number" min="0" data-example="nicoru" value="'+this.esc(this.sample.nicoru)+'"></label>'+
      '<label>ユーザーID<input type="text" data-example="userId" value="'+this.esc(this.sample.userId)+'"></label></div>';
  }
  preview(){
    const ex=this.sample;
    const chat={...ex,color:NgCompositeRules.commandColor(ex.cmd),opacity:1,
      size:ex.cmd.includes('big')?'big':ex.cmd.includes('small')?'small':'medium',
      type:ex.cmd.includes('ue')?'ue':ex.cmd.includes('shita')?'shita':'naka'};
    const valid=NgCompositeRules.validate(this.rules);
    const projected=valid?NgCompositeRules.project([chat],this.rules,()=>true,ex.videoId):null;
    const result=projected?.get(chat);
    this.root.querySelector('[data-ng-result]').innerHTML='<div class="ng-preview">'+
      '<article><small>変更前</small><p>'+this.esc(chat.text)+'</p><small>'+this.esc(chat.cmd)+'</small></article>'+
      '<article><small>変更後</small><p>'+this.esc(!valid?'不正なルールがあります':!result?'（変更なし）':
        !result.visible?'［非表示］':result.text)+'</p><small>'+this.esc(result?.cmd||chat.cmd)+'</small></article></div>'+
      '<p class="'+(valid?'ng-ok':'ng-error')+'">'+(valid?'プレビューは現在の全ルールによる結果です。':'入力内容を修正してください。')+'</p>';
  }
  render(){this.ruleList();this.detail();this.demoFields();this.preview();}
  changed(rebuild){this.onChange(NgCompositeRuleEditor.copy(this.rules));if(rebuild)this.render();else this.preview();}
  move(id,destination){
    const a=this.rules.findIndex(r=>r.id===id),b=this.rules.findIndex(r=>r.id===destination);
    if(a<0||b<0||a===b)return;
    const item=this.rules.splice(a,1)[0];this.rules.splice(b,0,item);this.changed(true);
  }
  click(e){
    const b=e.target.closest('button[data-ng-act]');if(!b||b.disabled)return;
    const act=b.dataset.ngAct,id=b.dataset.id;
    if(act==='add'){if(this.rules.length>=NgCompositeRules.MAX_RULES)return;
      const r=NgCompositeRuleEditor.newRule();this.rules.push(r);this.selected=r.id;}
    else if(act==='duplicate'){const r=this.current();if(!r||this.rules.length>=NgCompositeRules.MAX_RULES)return;
      const copy=NgCompositeRuleEditor.copy(r);copy.id=NgCompositeRuleEditor.newRule().id;copy.name+='（コピー）';this.rules.push(copy);this.selected=copy.id;}
    else if(act==='select'){this.selected=id;this.render();return;}
    else if(act==='delete'){this.rules=this.rules.filter(r=>r.id!==this.selected);this.selected=this.rules[0]?.id||'';}
    else if(act==='up'||act==='down'){const i=this.rules.findIndex(r=>r.id===id),j=i+(act==='up'?-1:1);
      if(i<0||j<0||j>=this.rules.length)return;
      const item=this.rules.splice(i,1)[0];this.rules.splice(j,0,item);}
    else if(act==='add-node'||act==='add-group'){
      const parent=this.find(b.dataset.parent);if(!parent||!parent.nodes||parent.nodes.length>=45)return;
      parent.nodes.push(act==='add-node'?{id:NgCompositeRuleEditor.newRule().id,field:'text',cmp:'contains',value:'',not:false}:
        {id:NgCompositeRuleEditor.newRule().id,kind:'group',mode:'all',nodes:[]});
    }else if(act==='remove-node'){
      const parent=this.parent(id);if(!parent)return;parent.nodes=parent.nodes.filter(n=>n.id!==id);
    }else return;
    this.changed(true);
  }
  input(e){
    const el=e.target,r=this.current();
    if(!this.root.contains(el))return;
    if(el.dataset.example){
      this.sample[el.dataset.example]=el.type==='number'?Number(el.value):el.value;this.preview();return;
    }
    if(!r)return;
    const key=el.dataset.rule;
    if(key){
      if(['enabled','stopOnMatch','exemptNicoru','keepProtectedOnAuthorHide','regexReplace'].includes(key))r[key]=el.checked;
      else if(['nicoruMin','dim'].includes(key))r[key]=Number(el.value);
      else if(key==='strip')r.strip=el.value.split(',').map(v=>v.trim()).filter(Boolean);
      else r[key]=el.value;
      this.changed(key==='action'||key==='normalizeColor');return;
    }
    if(el.dataset.groupMode){const n=this.find(el.dataset.groupMode);if(n)n.mode=el.value;this.changed(false);return;}
    const nodeId=el.dataset.nodeField||el.dataset.nodeCmp||el.dataset.nodeValue||el.dataset.nodeNot;
    if(!nodeId)return;
    const n=this.find(nodeId);if(!n)return;
    if(el.dataset.nodeField){
      n.field=el.value;n.value=['nicoru','score','vpos'].includes(n.field)?'1':
        n.field==='color'?'red':n.field==='size'?'big':n.field==='position'?'ue':
        n.field==='fork'?'normal':'';
      n.cmp=['nicoru','score','vpos'].includes(n.field)?'gte':
        n.field==='regex'?'regex':['text','cmd'].includes(n.field)?'contains':'equals';
      this.changed(true);
    }else if(el.dataset.nodeCmp){n.cmp=el.value;this.changed(false);}
    else if(el.dataset.nodeValue){n.value=el.value;this.changed(false);}
    else if(el.dataset.nodeNot){n.not=el.checked;this.changed(false);}
  }
  getDraft(){return NgCompositeRuleEditor.copy(this.rules);}
  replaceDraft(value){this.rules=NgCompositeRuleEditor.copy(value);this.selected=this.rules[0]?.id||'';this.render();}
  dispose(){this.shadow?.replaceChildren();}
}
//===END===
export {NgCompositeRuleEditor};
