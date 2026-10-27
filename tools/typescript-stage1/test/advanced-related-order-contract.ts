// Task554: strict menu ordering options and negative compile-time contracts.
import {RelatedMenuOrder,type RelatedMenuBuiltInOption,
  type RelatedMenuItem,type RelatedMenuLink,type RelatedMenuAction}
  from '../advanced-src/RelatedMenuOrder';

const pref:RelatedMenuBuiltInOption={openMode:'new-tab',copyFormat:'id'};
const link:RelatedMenuLink={id:'external-1',label:'Video Link',enabled:true};
const registered:RelatedMenuAction={id:'reload',label:'Reload'};
const entries:RelatedMenuItem[]=RelatedMenuOrder.entries([link],[registered],['builtin:official']);
const copy:string=RelatedMenuOrder.formatCopy('id',{videoId:'sm9'});
const valid:boolean=RelatedMenuOrder.validateOptions({official:pref});
const keys:string[]=RelatedMenuOrder.orderedKeys(['builtin:official'],['builtin:official']);
void entries;void copy;void valid;void keys;

// @ts-expect-error Custom links require a stable string identifier.
const badLink:RelatedMenuLink={label:'missing ID'};
void badLink;
// @ts-expect-error Unknown open modes must be rejected by the type contract.
const badMode:RelatedMenuBuiltInOption={openMode:'open-in-popup'};
void badMode;
// @ts-expect-error Copy format is a string command, not a numeric enum.
RelatedMenuOrder.formatCopy(1,{videoId:'sm9'});
// @ts-expect-error Ordered actual keys form an array of strings.
RelatedMenuOrder.orderedKeys([],42);
