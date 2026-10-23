// GENERATED FROM tools/typescript-stage1/nico-src/ClassList.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/dom/ClassListWrapper.js (Task785).
 * Cached `element.classList` lookup (one WeakMap shared by all callers).
 */
const ClassList = function (element) {
    if (this.map.has(element)) {
        // self.console.log('ClassListhas cache', element);
        return this.map.get(element);
    }
    const m = element.classList;
    this.map.set(element, m);
    return m;
}.bind({ map: new WeakMap() });
//===END===
export {
  ClassList
};
