// Task 088: 版を固定（本体が読む lit@2.0.2 と同じ）。この import の行は連結ビルドでは使われない（テストでは test/mocks/dll.js に置き換わる）。
import * as lit from 'https://esm.run/lit@2.0.2';
import {repeat} from 'https://esm.run/lit@2.0.2/directives/repeat';
import {classMap} from 'https://esm.run/lit@2.0.2/directives/class-map';

const dll = { directives: {}};
//===BEGIN===
dll.lit = lit;
dll.directives.repeat = repeat;
dll.directives.classMap = classMap;
//===END===
export {dll};