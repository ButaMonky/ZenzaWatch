import type {
  NicoChatGroupLayoutDatum,NicoChatGroupSlotDatum,
  NicoChatGroupViewModelContract
} from '../comment-src/NicoChatGroupViewModel';
const layout: NicoChatGroupLayoutDatum={id:'id',ypos:12,isOverflow:false};
const slot: NicoChatGroupSlotDatum={
  id:'id',slot:2,fork:0,no:5,vpos:200,begin:2,end:6,invisible:false
};
declare const group: NicoChatGroupViewModelContract;
const members: readonly unknown[]=group.members;
void layout;void slot;void members;
// @ts-expect-error An invalid nonboolean overflow marker is not a layout reply.
const invalid: NicoChatGroupLayoutDatum={id:1,ypos:1,isOverflow:'no'};
void invalid;
