// Task575: comment art is metadata, never a destructive source rewrite.
import {
  CommentArtProtection,
  type CommentArtCandidate,
  type CommentArtGroup
} from '../comment-src/CommentArtProtection';

const first:CommentArtCandidate={
  fork:0,layerId:0,date:1700000000,vpos:250,threadId:'10',
  userId:'synthetic-user',type:'ue',cmd:'ue full ender',
  text:'\u25a0\u25a0\u25a0'
};
const grouped:Map<CommentArtCandidate,CommentArtGroup>=
  CommentArtProtection.analyze([first],{enabled:true});
const metadata:CommentArtGroup|undefined=grouped.get(first);
const groupId:string|undefined=metadata?.layerId;
void groupId;

// @ts-expect-error A source comment must include a validated numeric layer.
const badLayer:CommentArtCandidate={date:1700000000,fork:0,vpos:100};
// @ts-expect-error The enabled setting is boolean, not a CSS class string.
CommentArtProtection.analyze([first],{enabled:'true'});
void badLayer;
