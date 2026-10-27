// Task574: strictly typed external API of trusted related-menu actions.
import {
  RelatedMenuActions,
  type RelatedMenuActionContext,
  type RelatedMenuActionLink,
  type RelatedMenuVideoInfo
} from '../menu-src/RelatedMenuActions';

const context:RelatedMenuActionContext={videoId:'sm9',watchId:'sm9',currentTime:'30'};
const info:RelatedMenuVideoInfo={
  videoId:'sm9',watchId:'sm9',
  owner:{type:'user',id:123,name:'投稿者'}
};
const link:RelatedMenuActionLink={
  id:'sample',label:'Sample',
  url:'https://example.invalid/{videoId}',openMode:'new-tab',shortcutKey:0
};
const normalized:RelatedMenuActionLink[]=RelatedMenuActions.getLinks([link]);
const count:number=RelatedMenuActions.openShortcutsByIds([link],['sample'],context,
  (url,target)=>{void url;void target;},
  async text=>{void text;});
const unobserve:()=>boolean=RelatedMenuActions.onChange(()=>{});
const valid:boolean=RelatedMenuActions.validateLinks([link]).valid;
const built:Readonly<RelatedMenuActionContext>=RelatedMenuActions.makeContext(info,12);
void normalized;void count;void unobserve;void valid;void built;

// @ts-expect-error A listener must be callable.
RelatedMenuActions.onChange(12);
// @ts-expect-error Unknown open modes are rejected by the type contract.
const invalidLink:RelatedMenuActionLink={id:'bad',label:'Bad',openMode:'teleport'};
// @ts-expect-error The caller must supply a valid owner structure.
const invalidInfo:RelatedMenuVideoInfo={owner:{type:'user',id:{secret:1}}};
void invalidLink;void invalidInfo;
