// Task784: compile-only contracts for CrossDomainGate.
import {CrossDomainGate} from '../nico-src/CrossDomainGate';

const gate = new CrossDomainGate({baseUrl: 'https://www.nicovideo.jp/loader', type: 'nicovideo'});
// @ts-expect-error baseUrl and type are required
void new CrossDomainGate({type: 'nicovideo'});
// Gate replies are opaque until the caller checks them.
const reply: Promise<unknown> = gate.fetch('https://www.nicovideo.jp/api', {method: 'GET'});
void reply;
void gate.fetch(new URL('https://www.nicovideo.jp/x'));
// @ts-expect-error the resource is a URL string, URL or Request
void gate.fetch(42);
void gate.sendMessage({hello: 1});
void gate.pushHistory('/watch/sm9', 'title');
void gate.bridgeDb({name: 'cache', ver: 1, stores: [{name: 'items'}]});
const valid: boolean = CrossDomainGate.hostReg.test('www.nicovideo.jp');
void valid;
gate.dispose();
