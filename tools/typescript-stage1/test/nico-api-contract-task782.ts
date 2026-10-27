// Task782: compile-only contracts for logSafe, objUtil and Observable.
import {logSafe} from '../nico-src/logSafe';
import {objUtil} from '../nico-src/objUtil';
import {Observable, WindowResizeObserver} from '../nico-src/Observable';

// Redacted copies are opaque; callers only log them.
const redacted: unknown = logSafe.redact({token: 'x'});
void redacted;
const secret: boolean = logSafe.isSecretKey('csrfToken');
void secret;
const mask: string = logSafe.MASK;
void mask;

objUtil.bridge({}, new Map());
// @ts-expect-error both arguments are objects
objUtil.bridge({}, 1);
const asMap: Map<string, number> = objUtil.toMap({a: 1});
void asMap;
const isObj: boolean = objUtil.isObject(null);
void isObj;

const source = new Observable(o => {
  o.next(1);
  o.complete();
  return () => undefined;
});
const sub = source.subscribe((value: unknown) => value);
sub.filter(v => v !== null).map(v => v);
sub.unsubscribe();
// @ts-expect-error a producer receives a subscriber, not a number
void new Observable((o: number) => o);
void Observable.of(1, 2, 3).concat([4]);
const resized = WindowResizeObserver.subscribe(() => undefined);
void resized.closed;
