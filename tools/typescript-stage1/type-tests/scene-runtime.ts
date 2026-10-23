import {SceneSearchController} from '../nico-src/SceneSearchController';
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
