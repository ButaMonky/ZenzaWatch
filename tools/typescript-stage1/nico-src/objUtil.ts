/**
 * Canonical TypeScript source for packages/lib/src/infra/objUtil.js (Task782).
 * Small object helpers. The commented-out makeProps experiment and the trailing
 * commented-out `safe` proxy of the legacy file are not carried over (no behaviour).
 */
type MethodHost = Record<string, unknown>;
type AnyMethod = (...args: unknown[]) => unknown;
type MapCtor<V> = new (entries: Iterable<readonly [string, V]>) => Map<string, V>;

const objUtil = (() => {
  const isObject = (e: unknown): e is object => e !== null && e instanceof Object;
  const PROPS = Symbol('PROPS');
  const REVISION = Symbol('REVISION');
  const CHANGED = Symbol('CHANGED');
  const HAS = Symbol('HAS');
  const SET = Symbol('SET');
  const GET = Symbol('GET');
  return {
    /** Copies `target`'s methods (bound to target) onto `self`. */
    bridge: (self: object, target: object, keys: string[] | null = null) => {
      (keys || Object.getOwnPropertyNames((target.constructor as {prototype: object}).prototype))
        .filter(key => typeof (target as MethodHost)[key] === 'function')
        .forEach(key => (self as MethodHost)[key] = ((target as MethodHost)[key] as AnyMethod).bind(target));
    },
    isObject,
    toMap: <V>(obj: Record<string, V> | Map<string, V>, mapper: MapCtor<V> = Map) => {
      if (obj instanceof mapper) {
        return obj;
      }
      return new mapper(Object.entries(obj));
    },
    mapToObj: <V>(map: Map<string, V> | unknown) => {
      if (!(map instanceof Map)) {
        return map;
      }
      const obj: Record<string, V> = {};
      for (const [key, val] of map as Map<string, V>) {
        obj[key] = val;
      }
      return obj;
    }
  };
})();

export {objUtil};
