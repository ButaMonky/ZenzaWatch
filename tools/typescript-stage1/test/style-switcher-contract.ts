// Type-only boundary for the legacy style operations (never executed at runtime).
import {StyleSwitcher, type StyleSwitcherUpdate} from '../src/StyleSwitcher';
const doc={} as Document;
const opts:StyleSwitcherUpdate={on:'style.zenza-open',off:'style.screenMode',document:doc};
StyleSwitcher.update(opts);
StyleSwitcher.update({document:doc});
StyleSwitcher.addClass('style','wide','full');
StyleSwitcher.removeClass('style','wide');
StyleSwitcher.toggleClass('style','full');
StyleSwitcher.toggleClass('style','full',true);
StyleSwitcher.toggleClass('style','full',false);
// @ts-expect-error third argument must be boolean or undefined.
StyleSwitcher.toggleClass('style','full','yes');
// @ts-expect-error selector must be a string.
StyleSwitcher.addClass(123);
// @ts-expect-error document must implement the Document interface.
StyleSwitcher.update({document:123});
// @ts-expect-error unsupported update field must not be silently accepted.
StyleSwitcher.update({on:'style.x',unexpected:42});
