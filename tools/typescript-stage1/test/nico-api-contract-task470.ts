// Task470: compile-only consumer contract for UaaLoader.
import {UaaLoader} from '../nico-src/UaaLoader';
import type {UaaLoadOptions, UaaLoaderClient} from '../nico-src/UaaLoader';

const client: UaaLoaderClient = UaaLoader;
const opts: UaaLoadOptions = {limit: 50, signal: new AbortController().signal};
const result: Promise<unknown> = client.load('sm9', opts);
void result;
void client.load('sm9');
void client.load('sm9', {limit: 0});
void client.load('sm9', {signal: undefined});
// @ts-expect-error limit must be numeric
void client.load('sm9', {limit: '50'});
async function incorrect() {
  const data = await client.load('sm9');
  // @ts-expect-error caller cannot assume arbitrary response fields
  return data.thanks;
}
void incorrect;
// @ts-expect-error video ID must be a string
void client.load(999);
