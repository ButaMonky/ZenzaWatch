import {NicoChatGroup} from '../comment-src/NicoChatGroup';
import {NicoChatFilter} from '../comment-src/NicoChatFilter';
import type {NicoGroupChat,NicoGroupFilter} from '../comment-src/NicoChatGroup';
import type {NicoChatFilterOptions} from '../comment-src/NicoChatFilter';
const filter: NicoGroupFilter={
  on:(_event,_fn)=>{},applyFilter:(chats)=>chats,isSafe:(_chat)=>true
};
const group=new NicoChatGroup('naka',{nicoChatFilter:filter});
const chats:NicoGroupChat[]=[{threadId:'123',fork:0,no:1,uniqNo:'x'}];
group.addChatArray(chats);
const options:NicoChatFilterOptions={enableFilter:true,removeNgMatchedUser:false};
const actualFilter=new NicoChatFilter(options);
void actualFilter;
// @ts-expect-error A filter must return a playable chat list.
const invalid:NicoGroupFilter={...filter,applyFilter:()=>42};
void invalid;
