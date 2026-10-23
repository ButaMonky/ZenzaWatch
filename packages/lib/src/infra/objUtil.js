import {bounce} from './bounce';
// GENERATED FROM tools/typescript-stage1/nico-src/objUtil.ts (Task782). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const objUtil = (() => {
    const isObject = (e) => e !== null && e instanceof Object;
    const PROPS = Symbol('PROPS');
    const REVISION = Symbol('REVISION');
    const CHANGED = Symbol('CHANGED');
    const HAS = Symbol('HAS');
    const SET = Symbol('SET');
    const GET = Symbol('GET');
    return {
        /** Copies `target`'s methods (bound to target) onto `self`. */
        bridge: (self, target, keys = null) => {
            (keys || Object.getOwnPropertyNames(target.constructor.prototype))
                .filter(key => typeof target[key] === 'function')
                .forEach(key => self[key] = target[key].bind(target));
        },
        isObject,
        toMap: (obj, mapper = Map) => {
            if (obj instanceof mapper) {
                return obj;
            }
            return new mapper(Object.entries(obj));
        },
        mapToObj: (map) => {
            if (!(map instanceof Map)) {
                return map;
            }
            const obj = {};
            for (const [key, val] of map) {
                obj[key] = val;
            }
            return obj;
        }
    };
})();
//===END===
export {objUtil};
