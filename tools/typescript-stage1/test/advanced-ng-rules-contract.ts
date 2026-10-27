// Task568: strict contract for validated NG rules and non-destructive projection.
import {NgCompositeRules,type NgCompositeInitialChat}
  from '../advanced-src/NgCompositeRules';

const chat:NgCompositeInitialChat={
  text:'test',cmd:'ue',userId:'synthetic',fork:0,
  nicoru:3,nicoruKnown:true,opacity:1
};
const acceptable:boolean=NgCompositeRules.validate([]);
const regexAcceptable:boolean=NgCompositeRules.isSafeRegex('test','i');
const result=NgCompositeRules.project([chat],[],()=>true,'sm9');
const scope:boolean=NgCompositeRules.matchScope({scope:'normal'},chat);
const numeric:number|null=NgCompositeRules.nicoru(chat);
void acceptable;void regexAcceptable;void result;void scope;void numeric;

// @ts-expect-error source chat data must be an array
NgCompositeRules.project(42,[]);
// @ts-expect-error valid flag argument is a string, not a number
NgCompositeRules.isSafeRegex('sample',22);
// @ts-expect-error filter chat scope must be declared
NgCompositeRules.matchScope({},chat);
