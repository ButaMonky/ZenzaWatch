/**
 * Canonical TypeScript source for packages/lib/src/dom/ClassListWrapper.js (Task785).
 * Cached `element.classList` lookup (one WeakMap shared by all callers).
 */
const ClassList = function(this: {map: WeakMap<Element, DOMTokenList>}, element: Element): DOMTokenList {
  if (this.map.has(element)) {
    // self.console.log('ClassListhas cache', element);
    return this.map.get(element) as DOMTokenList;
  }
  const m = element.classList;
  this.map.set(element, m);
  return m;
}.bind({map: new WeakMap()});

export {ClassList};
