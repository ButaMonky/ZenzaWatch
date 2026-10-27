// Task521: typed boundary to the existing runtime protocol normalizer.
// This does not modify or replace src/core.mjs.
export type CommentFork='main'|'owner'|'easy';
export interface CommentTarget {
  id: string;
  fork: CommentFork;
}
export interface CommentContext {
  videoId:string;
  server:string;
  language:string;
  targets:readonly CommentTarget[];
  threadKey?:string;
}
export interface CommentItem {
  id:string;
  no:number;
  vposMs:number;
  body:string;
  commands:string[];
  userId:string;
  postedAt:string;
  [field:string]:unknown;
}
export interface CommentThread extends CommentTarget {
  commentCount:number;
  comments:CommentItem[];
}
export declare function validateThreads(
  body:unknown,
  context:CommentContext,
  targets?:readonly CommentTarget[]
):CommentThread[];
export declare function integerOption(
  value:unknown,min:number,max:number
):number;
export declare function fail(code:string):never;
