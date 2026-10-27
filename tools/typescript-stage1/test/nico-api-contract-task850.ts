// Task850: compile-only contracts for uQuery (the wrapper is intentionally loose; the
// exported entry points and the main chainable calls are checked here).
import {uQuery, uq} from '../nico-src/uQuery';

const same: typeof uQuery = uq;
void same;
const $items = uQuery('.item');
$items.addClass('a b').removeClass('a').toggleClass('c', true);
const has: boolean = $items.hasClass('b');
void has;
$items.on('click', (e: MouseEvent) => e.preventDefault()).off('click');
const text: string = $items.text();
void text;
uQuery`<div>${1}</div>`;
// @ts-expect-error uQuery needs something to wrap
uQuery();
