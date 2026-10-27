/**
 * Canonical TypeScript source for packages/lib/src/text/reg.js (Task785).
 * Regex helper that remembers the last match per scope (`reg()` returns it).
 * TEXT-REG-PRIMITIVE-001 (Task787): exec() used to assign `str[$]` on the string primitive,
 * which throws in strict mode, and the two-argument form called `reg` without its scope
 * (a WeakMap key of undefined also throws).
 */
type Loose = Record<string | symbol, unknown>;
interface Last {str?: unknown; regstr?: string; result: RegExpExecArray | null}
interface Matcher {exec(str: string): RegExpExecArray | null; test(str: string): boolean}
type Reg = (regex?: RegExp | symbol, str?: string | symbol) => RegExpExecArray | null | Matcher;

const reg = (() => {
  const $ = Symbol('$');
  const undef = Symbol.for('undefined');
  const MAX_RESULT = 30;
  const smap = new WeakMap<object, {results: Last[]; last: Last}>();
  const self = {};

  const reg = function(this: object, regex: RegExp | symbol = undef, str: string | symbol = undef): RegExpExecArray | null | Matcher {
    const {results, last} = smap.has(this) ?
      smap.get(this) as {results: Last[]; last: Last} : {results: [] as Last[], last: {result: null} as Last};
    smap.set(this, {results, last});
    if (regex === undef) {
      return last ? last.result : null;
    }
    const regstr = regex.toString();
    if (str !== undef) {
      const found = results.find(r => regstr === r.regstr && str === r.str);
      return found ? found.result : (reg.call(this, regex) as Matcher).exec(str as string);
    }
    return {
      exec(str: string) {
        const result = (regex as RegExp).exec(str);
        Array.isArray(result) && result.forEach((r, i) => (result as unknown as Loose)['$' + i] = r);
        Object.assign(last, {str, regstr, result});
        results.push(last);
        results.length > MAX_RESULT && results.shift();
        (this as unknown as Loose)[$] = (regex as unknown as Loose)[$] = result;
        return result;
      },
      test(this: Matcher, str: string) { return !!this.exec(str); }
    };
  };

  const scope = (scopeObj = {}) => reg.bind(scopeObj);

  return Object.assign(reg.bind(self) as Reg, {$, scope});
})();

export {reg};
