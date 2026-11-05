import {SceneSearchController} from '../nico-src/SceneSearchController';
import {SceneSearchIntegrationBridge,type BridgeOptions} from '../nico-src/SceneSearchIntegrationBridge';
import {SceneSearchInteraction} from '../nico-src/SceneSearchInteraction';
import {ScenePreviewIdleLimiter} from '../nico-src/ScenePreviewIdleLimiter';
import {SceneSearchShortcutRouter} from '../nico-src/SceneSearchShortcutRouter';
import {SceneCommentSearch} from '../nico-src/SceneCommentSearch';
import {SceneCommentSearchPanel} from '../nico-src/SceneCommentSearchPanel';
import {SceneSearchPreferences} from '../nico-src/SceneSearchPreferences';
const read=(_key:string):unknown=>undefined;
const controller=new SceneSearchController({getPreference:read,
 resolvePreferences:()=>SceneSearchPreferences.resolve(read,()=>false),
 createLayout:()=>({dispose(){},render(snapshot){snapshot.time.toFixed();}}),
 loadPreview:async request=>{request.signal?.throwIfAborted();return request.time;}
});
const idle=new ScenePreviewIdleLimiter({controller,getSeconds:()=>2});
const interaction=new SceneSearchInteraction({controller,idleLimiter:idle,
 getPreviewRect:()=>({left:0,right:200,top:0,bottom:100}),subscribePointerMove:()=>()=>{}});
const search=new SceneCommentSearch({getChats:()=>[],getVideoId:()=>null,seekTo:seconds=>controller.setTime(seconds)});
const panel=new SceneCommentSearchPanel({document,search});
const router=new SceneSearchShortcutRouter({controller,interaction,commentSearchPanel:panel,getPreference:read,setPreference:()=>{}});
// The legacy bridge mounts DOM surfaces and replaces control slots per layout.
const surface=document.createElement('section');
interaction.previewEnter(surface);
interaction.previewEnter('preview');
interaction.previewFocus(true,surface);
interaction.previewLeave(surface,{clientX:1,clientY:2});
interaction.previewFocus(false,surface);
router.seekStepControl={seconds:5,setStep:()=>true};
router.commentSearchPanel=panel;
router.seekStepControl=null;
router.commentSearchPanel=null;
new SceneSearchController({getPreference:read,createLayout:()=>({dispose(){}}),resolvePreferences:null,loadPreview:null});
new ScenePreviewIdleLimiter({controller,getSeconds:()=>2,clock:undefined});
new SceneSearchInteraction({controller,getPreviewRect:()=>null,subscribePointerMove:()=>()=>{},clock:undefined});
// @ts-expect-error time must be numeric
controller.setTime('12');
// @ts-expect-error only real player modes are accepted
controller.setMode('small');
// @ts-expect-error a partial pointer cannot participate in corridor geometry
interaction.seekEnter({clientX:1});
// @ts-expect-error layouts must release resources
new SceneSearchController({getPreference:read,createLayout:()=>({})});
// @ts-expect-error immutable snapshots cannot be changed by consumers
controller.snapshot.shown=false;
// @ts-expect-error timer API cannot return a string ID
new ScenePreviewIdleLimiter({controller,getSeconds:()=>2,clock:{setTimeout:()=>'',clearTimeout:()=>{}}});

// P14 continuation: the Bridge must preserve typed controller/layout results.
declare const bridge:SceneSearchIntegrationBridge;
bridge.start().time.toFixed();
bridge.setMode('normal').shown.valueOf();
bridge.setVideo('sm1').videoId?.toUpperCase();
bridge.setTime(5).time.toFixed();
// @ts-expect-error consumers cannot mutate a controller-owned snapshot
bridge.start().time=10;
// @ts-expect-error mode transitions return an immutable snapshot
bridge.setMode('normal').pinned=true;
// @ts-expect-error video transitions return an immutable snapshot
bridge.setVideo('sm1').videoId='sm2';
// @ts-expect-error time changes do not return an untyped arbitrary object
bridge.setTime(5).notAControllerField();
const nativeLayout=bridge._createLayout({id:'00',mode:'normal'});
// @ts-expect-error layouts cannot render an incomplete/wrongly typed snapshot
nativeLayout.render?.({time:'invalid'});
const modernLayout=bridge._createModernLayout({id:'follow',mode:'normal'});
// @ts-expect-error modern layouts share the same complete state contract
modernLayout.render?.({shown:'yes'});
// @ts-expect-error a timer provider cannot return a string identifier
const badClock:BridgeOptions={clock:{setTimeout:()=>'',clearTimeout:()=>{}}};
// @ts-expect-error preview loading must be a callable owner, not an arbitrary value
const badPreview:BridgeOptions={loadPreview:123};
const seekOptions:BridgeOptions={getSeekTime:event=>{
 // @ts-expect-error native seek callbacks expose MouseEvent fields, not arbitrary properties
 event.notAnEventMethod();
 return event.clientX;
}};
// Native view ownership is not an arbitrary plugin payload.
// @ts-expect-error a legacy control root must be an HTMLElement
bridge._mountLegacyControls({root:new EventTarget()});
// @ts-expect-error a card cannot provide a string instead of a DOM root
bridge._mountCardControls({root:'not-a-node'});
// @ts-expect-error release only accepts a real native-card owner
bridge._releaseCard({root:42});
// @ts-expect-error comment docking requires a complete controller snapshot
bridge._syncCommentPreviewDock({root:document.body},{time:'bad'});
// @ts-expect-error frame-seek commands cannot carry an untyped string time
bridge._onCardAction('frame-seek',{time:'12'});
// @ts-expect-error placement consumes the same complete snapshot as rendering
bridge._placeModern({root:document.body},{shown:'yes'});
// @ts-expect-error even modern placement must own a real DOM card root
bridge._placeModern({root:'not-a-node'},bridge.state);
