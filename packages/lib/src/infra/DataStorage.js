import {Emitter} from '../Emitter';
import {objUtil} from './objUtil';
import {Observable} from './Observable';
import {bounce} from './bounce';
import {dimport} from './dimport';
import {global} from '../../../../src/ZenzaWatchIndex';
//===BEGIN===
//@require Observable
//@require bounce
class DataStorage {

  static create(defaultData, options = {}) {
    return new DataStorage(defaultData, options);
    // const {StorageArea} = dimport('std:kv-storage').catch(() => null);
    // if (!StorageArea) {
    //   return new DataStorage(defaultData, options);
    // } else {
    //   options.dbStorage = new DataStorage(defaultData, {...options});
    //   options.storage = new StorageArea(options.PREFIX || global.PRODUCT);
    //   return new DataStorage(defaultData, options);
    // }
  }
  static clone(dataStorage) {
    const options = {
      prefix:  dataStorage.prefix,
      storage: dataStorage.storage,
      ignoreExportKeys: dataStorage.options.ignoreExportKeys,
      readonly: dataStorage.readonly,
      normalizeImport: dataStorage.options.normalizeImport,
      validateImport: dataStorage.options.validateImport,
      preserveInvalidKeys: dataStorage.options.preserveInvalidKeys
    };
    return DataStorage.create(dataStorage.default, options);
  }

  constructor(defaultData, options = {}) {

    this.options = options;
    this.default = defaultData;
    this._data = Object.assign({}, defaultData);
    this.prefix = `${options.prefix || 'DATA'}_`;
    this.storage = options.storage || localStorage;
    this._ignoreExportKeys = options.ignoreExportKeys || [];
    this.readonly = options.readonly;
    this.silently = false;
    this._changed = new Map();
    this._onChange = bounce.time(this._onChange.bind(this));

    objUtil.bridge(this, new Emitter());

    this.restore().then(() => {
      this.props = this._makeProps(defaultData);
      this.emitResolve('restore');
    });

    this.logger = (self || window).console;
    this.consoleSubscriber = {
      next: (v, ...args) => this.logger.log('next', v, ...args),
      error: (e, ...args) => this.logger.warn('error', e, ...args),
      complete: (c, ...args) => this.logger.log('complete', c, ...args)
    };
  }

  _makeProps(defaultData = {}, namespace = '') {
    namespace = namespace ? `${namespace}.` : '';
    const self = this;
    const def = {};
    const props = {};
    Object.keys(defaultData).sort()
      // .filter(key => !this._ignoreExportKeys.includes(key) && key.includes(namespace))
      .filter(key => key.includes(namespace))
      .forEach(key => {
        const k = key.slice(namespace.length);
        if (k.includes('.')) {
          const ns = k.slice(0, k.indexOf('.'));
          props[ns] = this._makeProps(defaultData, `${namespace}${ns}`);
        }
        def[k] = {
          enumerable: !this._ignoreExportKeys.includes(key),
          get() { return self.getValue(key); },
          set(v) { self.setValue(key, v); }
        };
    });
    Object.defineProperties(props, def);
    return props;
  }

  _onChange() {
    const changed = this._changed;
    this.emit('change', changed);
    for (const [key, val] of changed) {
      this.emitAsync('update', key, val);
      this.emitAsync(`update-${key}`, val);
    }
    this._changed.clear();
  }

  onkey(key, callback) {
    this.on(`update-${key}`, callback);
  }

  offkey(key, callback) {
    this.off(`update-${key}`, callback);
  }

  async restore(storage) {
    storage = storage || this.storage;
    Object.keys(this.default).forEach(key => {
      const storageKey = this.getStorageKey(key);
      if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
        try {
          this._data[key] = JSON.parse(storage[storageKey]);
        } catch (e) {
          console.error('config parse error key:"%s" value:"%s" ', key, storage[storageKey], e);
          if (!this.options?.preserveInvalidKeys?.includes(key)) { delete storage[storageKey]; }
          this._data[key] = this.default[key];
        }
      } else {
        this._data[key] = this.default[key];
      }
    });
  }

  getNativeKey(key) {
    return key;
  }

  getStorageKey(key) {
    return `${this.prefix}${key}`;
  }

  async refresh(key, storage) {
    storage = storage || this.storage;
    key = this.getNativeKey(key);
    const storageKey = this.getStorageKey(key);
    if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
      try {
        this._data[key] = JSON.parse(storage[storageKey]);
      } catch (e) {
        console.error('config parse error key:"%s" value:"%s" ', key, storage[storageKey], e);
      }
    }
    return this._data[key];
  }

  getValue(key) {
    key = this.getNativeKey(key);
    return this._data[key];
  }

  deleteValue(key) {
    key = this.getNativeKey(key);
    const storageKey = this.getStorageKey(key);
    this.storage.removeItem(storageKey);
    this._data[key] = this.default[key];
  }

  setValue(key, value) {
    const _key = key;
    key = this.getNativeKey(key);
    if (this._data[key] === value || value === undefined) {
      return;
    }
    const storageKey = this.getStorageKey(key);
    const storage = this.storage;
    if (!this.readonly) {
      try {
        storage[storageKey] = JSON.stringify(value);
      } catch (e) {
        window.console.error(e);
      }
    }
    this._data[key] = value;

    // console.log('%cupdate "%s" = "%s"', 'background: cyan', _key, value);
    if (!this.silently) {
      this._changed.set(_key, value);
      this._onChange();
    }
  }

  setValueSilently(key, value) {
    const isSilent = this.silently;
    this.silently = true;
    this.setValue(key, value);
    this.silently = isSilent;
  }

  export(isAll = false) {
    const result = {};
    const _default = this.default;

    Object.keys(this.props)
      .filter(key => isAll || (_default[key] !== this._data[key]))
      .forEach(key => result[key] = this.getValue(key));
    return result;
  }

  exportJson() {
    return JSON.stringify(this.export(), null, 2);
  }

  import(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('設定データはJSONオブジェクトで指定してください。');
    }
    // props also contains synthetic namespace objects. Only real default keys
    // are persisted; old/unknown keys and private session values are ignored.
    const entries = Object.keys(this.default)
      .filter(key => !this._ignoreExportKeys.includes(key))
      .map(key => {
        const raw = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : this.default[key];
        const value = this.options.normalizeImport ? this.options.normalizeImport(key, raw) : raw;
        const expected = this.default[key];
        if (typeof value !== typeof expected || value === null && expected !== null ||
            Array.isArray(value) !== Array.isArray(expected) ||
            typeof value === 'number' && !Number.isFinite(value) ||
            this.options.validateImport && !this.options.validateImport(key, value)) {
          throw new TypeError(`設定値が不正です: ${key}`);
        }
        const json = JSON.stringify(value);
        if (json === undefined) { throw new TypeError(`設定値を保存できません: ${key}`); }
        return {key, value, json, storageKey: this.getStorageKey(key)};
      });
    if (!this.readonly) {
      const written = [];
      try {
        for (const entry of entries) {
          const previous = this.storage[entry.storageKey];
          this.storage[entry.storageKey] = entry.json;
          written.push({key: entry.storageKey, previous});
        }
      } catch (error) {
        // localStorage has no multi-key transaction. Restore completed writes
        // best-effort and report any failure instead of claiming success.
        for (const {key, previous} of written.reverse()) {
          try {
            if (previous === undefined) { delete this.storage[key]; }
            else { this.storage[key] = previous; }
          } catch (restoreError) { window.console.error('設定の復元に失敗しました', restoreError); }
        }
        throw error;
      }
    }
    for (const {key, value} of entries) { this._data[key] = value; }
  }

  importJson(json) {
    this.import(JSON.parse(json));
  }

  getKeys() {
    return Object.keys(this.props);
  }

  clearConfig() {
    this.silently = true;
    const storage = this.storage;
    Object.keys(this.default)
      .filter(key => !this._ignoreExportKeys.includes(key)).forEach(key => {
        const storageKey = this.getStorageKey(key);
        try {
          if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
            console.log('delete storage', storageKey, storage[storageKey]);
            delete storage[storageKey];
          }
          this._data[key] = this.default[key];
        } catch (e) {}
    });
    this.silently = false;
  }

  namespace(name) {
    const namespace = name ? `${name}.` : '';
    const updateListeners = new Map();
    const result = {
      getValue: key => this.getValue(`${namespace}${key}`),
      setValue: (key, value) => this.setValue(`${namespace}${key}`, value),
      on: (key, func) => {
        if (key === 'update') {
          if (updateListeners.has(func)) { return result; }
          const onUpdate = (key, value) => {
            if (key.startsWith(namespace)) {
              func(key.slice(namespace.length), value);
            }
          };
          updateListeners.set(func, onUpdate);
          this.on('update', onUpdate);
          return result;
        }
        return this.onkey(`${namespace}${key}`, func);
      },
      off: (key, func) => {
        if (key === 'update') {
          if (!func) {
            for (const listener of updateListeners.values()) {
              this.off('update', listener);
            }
            updateListeners.clear();
          } else if (updateListeners.has(func)) {
            this.off('update', updateListeners.get(func));
            updateListeners.delete(func);
          }
          return result;
        }
        return this.offkey(`${namespace}${key}`, func);
      },
      onkey: (key, func) => {
        this.on(`update-${namespace}${key}`, func);
        return result;
      },
      offkey: (key, func) => {
        this.off(`update-${namespace}${key}`, func);
        return result;
      },
      props: this.props[name],
      refresh: () => this.refresh(),
      subscribe: subscriber => {
        return this.subscribe(subscriber)
          .filter(changed => changed.keys().some(k => k.startsWith(namespace)))
          .map(changed => {
            const result = new Map;
            for (const k of changed.keys()) {
              k.startsWith(namespace) && result.set(k, changed.get(k));
            }
            return result;
          });
      }
    };
    return result;
  }

  subscribe(subscriber) {
    subscriber = subscriber || this.consoleSubscriber;
    const observable = new Observable(o => {
      const onChange = changed => o.next(changed);
      this.on('change', onChange);
      return () => this.off('change', onChange);
    });
    return observable.subscribe(subscriber);
  }

  // for debug
  watch() {
    // if (this.consoleSubscription) { return; }
    // return this.consoleSubscription = this.subscribe();
  }
  unwatch() {
    this.consoleSubscription && this.consoleSubscription.unsubscribe();
    this.consoleSubscription = null;
  }

}



//===END===

class KVSDataStorage extends DataStorage {
  constructor(defaultData, options = {}) {
    super(defaultData, options);
  }

  getStorageKey(key) {
    return key;
  }

  async restore(storage) {
    storage = storage || this.storage;
    const dbs = this.options.dbStorage.export();
    for (const key of Object.keys(dbs)) {
      const value = dbs[key];
      this.storage.set(key, value);
      this.dbStorage.deleteValue(key);
    }
    for (const key of Object.keys(this.default)) {
      const storageKey = key;
      const value = await this.storage.get(storageKey);
      if (value !== undefined) {
          this._data[key] = value;
      } else {
        this._data[key] = this.default[key];
      }
    }
  }

  async refresh(key, storage) { // TODOOOOOO
    storage = storage || this.storage;
    key = this.getNativeKey(key);
    const storageKey = key;
    const value = await this.storage.get(storageKey);
    if (value !== undefined) {
      this._data[key] = value;
    }
    return this._data[key];
  }

  setValue(key, value) {
    const _key = key;
    key = this.getNativeKey(key);
    if (this._data[key] === value || arguments.length < 2 || value === undefined) {
      return;
    }
    const storageKey = key;
    const storage = this.storage;
    if (!this.readonly) {
      storage.set(storageKey, value);
    }
    this._data[key] = value;

    if (!this.silently) {
      this._changed.set(_key, value);
      this._onChange();
    }
  }

}

export {DataStorage};