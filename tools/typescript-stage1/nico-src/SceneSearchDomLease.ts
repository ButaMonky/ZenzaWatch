/** Strict typed source of the original DOM lease, preserving runtime semantics. */
export interface SceneSearchDomLeaseOptions {
 position?:boolean;styles?:readonly string[];classes?:readonly string[];
 attributes?:readonly string[];hidden?:boolean;
}
type StyleSnapshot={name:string;value:string;priority:string};
type ClassSnapshot={name:string;present:boolean};
type AttributeSnapshot={name:string;value:string|null};
type HiddenSnapshot={value:boolean|"until-found";attribute:string|null};
type PositionSnapshot={parent:Node|null;anchor:Comment|null;previous:ChildNode[];next:ChildNode[]};
export class SceneSearchDomLease {
  declare private _node:HTMLElement;
  declare private _released:boolean;
  declare private _styles:StyleSnapshot[];
  declare private _classes:ClassSnapshot[];
  declare private _attributes:AttributeSnapshot[];
  declare private _hidden:HiddenSnapshot|null;
  declare private _emptyStyle:boolean;
  declare private _emptyClass:boolean;
  declare private _position:PositionSnapshot|null;
  static typography = Object.freeze([
    'font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'word-spacing'
  ]);

  static _positionOwners:WeakMap<HTMLElement,SceneSearchDomLease> = new WeakMap();

  static preserveTypography(node:HTMLElement):void {
    const computed = node.ownerDocument.defaultView!.getComputedStyle(node);
    const values = this.typography.map(name => [name, computed.getPropertyValue(name)] as [string,string]);
    values.forEach(([name, value]) => {
      if (value) { node.style.setProperty(name, value, node.style.getPropertyPriority(name)); }
    });
  }

  constructor(node:HTMLElement, options:SceneSearchDomLeaseOptions = {}) {
    if (options.position && SceneSearchDomLease._positionOwners.has(node)) {
      throw new Error('This node already has a position lease');
    }
    this._node = node;
    this._released = false;
    this._styles = Array.from(new Set(options.styles || []), name => ({
      name, value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name)
    }));
    this._classes = Array.from(new Set(options.classes || []), name => ({
      name, present: node.classList.contains(name)
    }));
    this._attributes = Array.from(new Set(options.attributes || []), name => {
      if (['class', 'style'].includes(name.toLowerCase())) {
        throw new TypeError('Lease individual class or style members instead of their whole attribute');
      }
      return {name, value: node.getAttribute(name)};
    });
    this._hidden = options.hidden ? {value: node.hidden, attribute: node.getAttribute('hidden')} : null;
    this._emptyStyle = this._styles.length > 0 && !node.hasAttribute('style');
    this._emptyClass = this._classes.length > 0 && !node.hasAttribute('class');
    this._position = null;
    if (options.position) {
      const parent = node.parentNode;
      const siblings = parent ? Array.from(parent.childNodes) : [];
      const index = siblings.indexOf(node);
      this._position = {
        parent, anchor: null,
        previous: siblings.slice(0, index).reverse(), next: siblings.slice(index + 1)
      };
      SceneSearchDomLease._positionOwners.set(node, this);
    }
  }

  get node() { return this._node; }
  get released() { return this._released; }

  moveTo(parent:Node, before:Node|null = null):void {
    if (this._released) { throw new Error('Cannot move a released DOM lease'); }
    if (!this._position) { throw new Error('Moving a node requires a position lease'); }
    try {
      const position = this._position!;
      if (position.parent && !position.anchor) {
        // Install the marker only when borrowing starts. If insertion throws after
        // mutating the DOM, this already-created lease still owns its rollback.
        position.anchor = this._node.ownerDocument.createComment('scene-search-dom-lease');
        position.parent.insertBefore(position.anchor, this._anchorReference(position));
      }
      this._moveNode(parent, before);
    } catch (error) {
      try { this.restore(); } catch (restoreError) {
        throw new AggregateError([error, restoreError], 'DOM move and rollback both failed');
      }
      throw error;
    }
  }

  restore() {
    if (this._released) { return; }
    const errors:unknown[] = [];
    const attempt = (action:()=>void):boolean => {
      try { action(); return true; } catch (error) { errors.push(error); return false; }
    };
    if (this._position && attempt(() => this._restorePosition())) { this._position = null; }
    this._styles = this._styles.filter(snapshot => !attempt(() => {
      const {name, value, priority} = snapshot;
      const style = this._node.style;
      if (style.getPropertyValue(name) === value && style.getPropertyPriority(name) === priority) { return; }
      if (value) { style.setProperty(name, value, priority); } else { style.removeProperty(name); }
    }));
    this._classes = this._classes.filter(({name, present}) => !attempt(() => {
      if (this._node.classList.contains(name) !== present) { this._node.classList.toggle(name, present); }
    }));
    this._attributes = this._attributes.filter(({name, value}) =>
      !attempt(() => this._restoreAttribute(name, value)));
    if (this._hidden && attempt(() => {
      if (this._node.hidden !== this._hidden!.value) { this._node.hidden = this._hidden!.value; }
      this._restoreAttribute('hidden', this._hidden!.attribute);
    })) { this._hidden = null; }
    if (this._emptyStyle && !this._styles.length && attempt(() => {
      if (this._node.getAttribute('style') === '') { this._node.removeAttribute('style'); }
    })) { this._emptyStyle = false; }
    if (this._emptyClass && !this._classes.length && attempt(() => {
      if (this._node.getAttribute('class') === '') { this._node.removeAttribute('class'); }
    })) { this._emptyClass = false; }

    // Successfully restored aspects are removed immediately. A retry owns only
    // pending work, so it cannot overwrite new native updates to released aspects.
    if (!this._position && !this._styles.length && !this._classes.length &&
        !this._attributes.length && !this._hidden && !this._emptyStyle && !this._emptyClass) {
      this._released = true;
      if (SceneSearchDomLease._positionOwners.get(this._node) === this) {
        SceneSearchDomLease._positionOwners.delete(this._node);
      }
    }
    this._throwErrors(errors, 'Could not fully restore the DOM lease');
  }

  _restoreAttribute(name:string, value:string|null):void {
    if (this._node.getAttribute(name) === value) { return; }
    if (value === null) { this._node.removeAttribute(name); } else { this._node.setAttribute(name, value); }
  }

  _anchorReference(position:PositionSnapshot):Node|null {
    const siblings = Array.from(position.parent!.childNodes);
    const index = siblings.indexOf(this._node);
    const previous = position.previous.find(node => node.parentNode === position.parent);
    const next = position.next.find(node => node.parentNode === position.parent);
    // Native insertions around an unmoved node retain their ordering. If the
    // node itself was reordered before borrowing, use its captured neighbors.
    if (index >= 0 && (!previous || siblings.indexOf(previous) < index) &&
        (!next || siblings.indexOf(next) > index)) { return this._node; }
    return this._positionReference(position);
  }

  _positionReference(position:PositionSnapshot):Node|null {
    if (position.anchor && position.anchor.parentNode === position.parent) {
      return position.anchor.nextSibling;
    }
    const next = position.next.find(node => node.parentNode === position.parent);
    if (next) { return next; }
    const previous = position.previous.find(node => node.parentNode === position.parent);
    return previous ? previous.nextSibling : null;
  }

  _restorePosition():void {
    const position = this._position!;
    if (position.parent) {
      this._moveNode(position.parent, this._positionReference(position));
    } else if (this._node.parentNode) {
      this._withFocus(() => this._node.parentNode!.removeChild(this._node));
    }
    if (position.anchor && position.anchor.parentNode) {
      position.anchor.parentNode.removeChild(position.anchor);
    }
  }

  _moveNode(parent:Node, before:Node|null):void {
    if (this._node.parentNode === parent &&
        (before === this._node || before === this._node.nextSibling)) { return; }
    this._withFocus(() => parent.insertBefore(this._node, before));
  }

  _withFocus(action:()=>void):void {
    const document = this._node.ownerDocument;
    const active = document.activeElement;
    const ownsFocus = active && this._node.contains(active);
    const errors:unknown[] = [];
    try { action(); } catch (error) { errors.push(error); }
    const current = document.activeElement;
    // Moving an element can drop focus onto the document body. A different
    // focused control belongs to the user or a native callback and must win.
    if (ownsFocus && current !== active &&
        (!current || current === document.body || current === document.documentElement)) {
      try { (active as HTMLElement).focus({preventScroll: true}); } catch (error) { errors.push(error); }
    }
    this._throwErrors(errors, 'DOM movement and focus restoration both failed');
  }

  _throwErrors(errors:unknown[], message:string):void {
    if (errors.length === 1) { throw errors[0]; }
    if (errors.length > 1) { throw new AggregateError(errors, message); }
  }
}
