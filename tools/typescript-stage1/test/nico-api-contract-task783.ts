// Task783: compile-only contracts for workerUtil and IndexedDbStorage.
import {workerUtil} from '../nico-src/workerUtil';
import {IndexedDbStorage} from '../nico-src/IndexedDbStorage';
import type {DbDefinition, StoreApi} from '../nico-src/IndexedDbStorage';

const available: boolean = workerUtil.isAvailable;
void available;
workerUtil.env({TOKEN: 'x'});
const rpc = workerUtil.createCrossMessageWorker(function(self) { self.onmessage = () => 'ok'; }, {name: 'Example'});
void rpc;
// @ts-expect-error the worker body is a function or its source text
workerUtil.createCrossMessageWorker(42, {name: 'Bad'});

const definition: DbDefinition = {
  name: 'cache',
  ver: 1,
  stores: [{name: 'items', indexes: [{name: 'updatedAt', keyPath: 'updatedAt', params: {unique: false}}],
    definition: {keyPath: 'id', autoIncrement: false}}]
};
void IndexedDbStorage.open(definition).then(db => {
  const items = db['items'] as StoreApi;
  void items.put({id: 'a'});
  // Stored records are opaque until the caller checks them.
  const found: Promise<unknown> = items.get({key: 'a'});
  void found;
  // @ts-expect-error a query object with a key is required
  void items.get('a');
});
// @ts-expect-error stores are required
void IndexedDbStorage.open({name: 'cache'});
