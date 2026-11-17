// Task1069: テスト用の src/ZenzaContext.js。
// 本物の ZenzaContext は空の入れ物で、中身は起動の時（src/_template.js の monkey）に入る。単体テストでは起動しないので、
// 今までどおり開発用の src/ZenzaWatchIndex.js の中身（debug・emitter・config など）が入った同じオブジェクトを渡す。
import {ZenzaWatch, global, dll, PRODUCT, TOKEN} from '../../src/ZenzaWatchIndex';
const NICORU = '';
const util = {};
// テストでは登録した処理をその場で呼ぶ（今の配布物と同じ）
const startup = {add(name, fn) { fn(); }, defer() {}, run() {}, pending: []};
export {ZenzaWatch, global, NICORU, dll, util, PRODUCT, TOKEN, startup};
