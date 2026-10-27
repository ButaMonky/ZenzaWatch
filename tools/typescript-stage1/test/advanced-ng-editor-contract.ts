// Task570: strict typed contracts of the composite NG editor.
import {NgCompositeRuleEditor} from '../advanced-src/NgCompositeRuleEditor';

declare const host: HTMLElement;
const editor=new NgCompositeRuleEditor(host,[],draft=>{
  const count:number=draft.length;
  const id:string|undefined=draft[0]?.id;
  void count;void id;
});
const currentId:string=editor.selected;
const rules=editor.getDraft();
const safeId:string=NgCompositeRuleEditor.freshId(new Set<string>());
void currentId;void rules;void safeId;
editor.replaceDraft([]);

// @ts-expect-error Editor root must be a DOM element.
new NgCompositeRuleEditor(42,[],()=>{});
// @ts-expect-error Draft-changed callback is required.
new NgCompositeRuleEditor(host,[]);
// @ts-expect-error Stable rule IDs are strings.
NgCompositeRuleEditor.freshId(new Set<number>([1]));
