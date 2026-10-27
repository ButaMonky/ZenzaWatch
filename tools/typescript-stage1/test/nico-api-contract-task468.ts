// Task468: compile-time contracts for decoration bulk API.
import {AdDecorationLoader} from '../nico-src/AdDecorationLoader';
import type {AdDecorationProgress,AdDecorationClient} from '../nico-src/AdDecorationLoader';

const loader: AdDecorationClient=AdDecorationLoader;
const loadResult: Promise<Map<string,unknown>>=loader.load(['sm1','sm2']);
void loadResult;
void loader.load(null);
void loader.loadFresh(['sm1'],(progress:AdDecorationProgress)=>{
  const completed:number=progress.checked;
  const total:number=progress.total;
  void completed;
  void total;
});
// @ts-expect-error IDs must be text
void loader.load([123]);
// @ts-expect-error progress.total must be a number
void loader.loadFresh(['sm1'],progress=>progress.total.toUpperCase());
async function decorationName():Promise<string>{
  const map=await loader.load(['sm1']);
  const value:unknown=map.get('sm1');
  // @ts-expect-error live API response remains unknown until validated
  void value.toUpperCase();
  return typeof value==='string'?value:'normal';
}
void decorationName;
