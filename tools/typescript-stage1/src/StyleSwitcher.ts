/**
 * Canonical TypeScript source for ZenzaWatch's legacy StyleSwitcher.js.
 * Do not change the DOM behavior or substitute a framework for the userscript.
 */
export type SwitchableStyleElement = HTMLStyleElement | HTMLLinkElement;
export interface StyleSwitcherUpdate {
  on?: string | null;
  off?: string | null;
  document?: Document;
}

class StyleSwitcher {
  static update({on, off, document = window.document}: StyleSwitcherUpdate): void {
    if (on) {
      Array.from(document.head.querySelectorAll<SwitchableStyleElement>(on))
        .forEach(s => { s.disabled = false; s.dataset.switch = 'on'; });
    }
    if (off) {
      Array.from(document.head.querySelectorAll<SwitchableStyleElement>(off))
        .forEach(s => { s.disabled = true; s.dataset.switch = 'off'; });
    }
  }

  static addClass(selector: string, ...classNames: string[]): void {
    classNames.forEach(name => {
      Array.from(document.head.querySelectorAll<SwitchableStyleElement>(`${selector}.${name}`))
        .forEach(s => { s.disabled = false; s.dataset.switch = 'on'; });
    });
  }

  static removeClass(selector: string, ...classNames: string[]): void {
    classNames.forEach(name => {
      Array.from(document.head.querySelectorAll<SwitchableStyleElement>(`${selector}.${name}`))
        .forEach(s => { s.disabled = true; s.dataset.switch = 'off'; });
    });
  }

  static toggleClass(selector: string, className: string, v?: boolean): void {
    Array.from(document.head.querySelectorAll<SwitchableStyleElement>(`${selector}.${className}`))
      .forEach(s => {
        s.disabled = v === undefined ? !s.disabled : !v;
        s.dataset.switch = s.disabled ? 'off' : 'on';
      });
  }
}

export {StyleSwitcher};
