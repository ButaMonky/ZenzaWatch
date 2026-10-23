import {Emitter} from '../../../lib/src/Emitter';
import {SlotLayoutWorker} from './SlotLayoutWorker';
import {NicoChatGroupViewModel} from './NicoChatGroupViewModel';
import {NicoChat} from './NicoChat';
import {Config} from '../../../../src/Config';
import {NicoComment} from './NicoComment';
//===BEGIN===

class NicoCommentViewModel extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
  async initialize(nicoComment) {
    const offScreen = this._offScreen = await NicoComment.offscreenLayer.get();

    this._currentTime = 0;
    this._lastUpdate = 0;

    this._topGroup =
      new NicoChatGroupViewModel(nicoComment.getGroup(NicoChat.TYPE.TOP), offScreen);
    this._nakaGroup =
      new NicoChatGroupViewModel(nicoComment.getGroup(NicoChat.TYPE.NAKA), offScreen);
    this._bottomGroup =
      new NicoChatGroupViewModel(nicoComment.getGroup(NicoChat.TYPE.BOTTOM), offScreen);

    const config = Config.namespace('commentLayer');
    config.onkey('protectCA', () => { void this._onCommentArtProtectionChange(); });
    if (config.props.enableSlotLayoutEmulation) {
      this._slotLayoutWorker = SlotLayoutWorker.create();
      this._updateSlotLayout = _.debounce(this._updateSlotLayout.bind(this), 100);
    }

    nicoComment.on('setData', this._onSetData.bind(this));
    nicoComment.on('clear', this._onClear.bind(this));
    nicoComment.on('change', this._onChange.bind(this));
    nicoComment.on('parsed', this._onCommentParsed.bind(this));
    nicoComment.on('currentTime', this._onCurrentTime.bind(this));
  }
  async _onCommentArtProtectionChange() {
    const generation = this._commentArtGeneration = (this._commentArtGeneration || 0) + 1;
    const groups = [this._topGroup, this._nakaGroup, this._bottomGroup];
    const sources = groups.map(group => group._members);
    const previous = groups.map(group => group._members.map(member => ({
      member,
      metadata: member._commentArtMetadata,
      y: member._y,
      overflow: member._isOverflow,
      ready: member._isLayouted
    })));
    const ok = await Promise.all(groups.map(group => group._execCommentLayoutWorker()));
    if (generation !== this._commentArtGeneration ||
        groups.some((group, i) => group._members !== sources[i])) { return; }
    if (!ok.every(Boolean)) {
      for (const snapshot of previous) {
        for (const old of snapshot) {
          old.member._commentArtMetadata = old.metadata;
          old.member._y = old.y;
          old.member._isOverflow = old.overflow;
          old.member._isLayouted = old.ready;
        }
      }
      return;
    }
    this.emit('setData');
  }
  _onSetData() {
    this._commentArtGeneration = (this._commentArtGeneration || 0) + 1;
    this.emit('setData');
  }
  _onClear() {
    this._commentArtGeneration = (this._commentArtGeneration || 0) + 1;
    this._topGroup.reset();
    this._nakaGroup.reset();
    this._bottomGroup.reset();

    this._lastUpdate = Date.now();
    this.emit('clear');
  }
  _onCurrentTime(sec) {
    this._currentTime = sec;
    this.emit('currentTime', this._currentTime);
  }
  _onChange(e) {
    this._lastUpdate = Date.now();
    this._updateSlotLayout();
    console.log('NicoCommentViewModel.onChange: ', e);
  }
  _onCommentParsed() {
    this._lastUpdate = Date.now();
    this._updateSlotLayout();
  }
  async _updateSlotLayout() {
    if (!this._slotLayoutWorker) {
      return;
    }

    window.console.time('SlotLayoutWorker call');
    const params = {
      lastUpdate: this._lastUpdate,
      top: this._topGroup.bulkSlotData,
      naka: this._nakaGroup.bulkSlotData,
      bottom: this._bottomGroup.bulkSlotData
    };
    let result;
    try {
      result = await this._slotLayoutWorker.post({command: 'layout', params});
    } catch (_) {
      window.console.timeEnd('SlotLayoutWorker call');
      return console.warn('slotLayoutWorker request failed');
    }
    if (!result || result.lastUpdate !== this._lastUpdate) {
      window.console.timeEnd('SlotLayoutWorker call');
      return console.warn('slotLayoutWorker changed', this._lastUpdate,
        result && result.lastUpdate);
    }
    // Validate all three groups before changing any slot. The worker may fail,
    // return an old generation or send an incomplete/mismatched response.
    const isValidGroup = (actual, original) => Array.isArray(actual) &&
      actual.length === original.length && original.every((input, i) => {
        const row = actual[i];
        return row && row.id === input.id && row.no === input.no &&
          row.fork === input.fork && row.invisible === input.invisible &&
          (input.invisible ? row.slot === input.slot :
            Number.isInteger(row.slot) && row.slot >= 0 && row.slot < 40);
      });
    if (!isValidGroup(result.top, params.top) ||
        !isValidGroup(result.naka, params.naka) ||
        !isValidGroup(result.bottom, params.bottom)) {
      window.console.timeEnd('SlotLayoutWorker call');
      return console.warn('slotLayoutWorker invalid response');
    }
    this._topGroup.bulkSlotData = result.top;
    this._nakaGroup.bulkSlotData = result.naka;
    this._bottomGroup.bulkSlotData = result.bottom;
    window.console.timeEnd('SlotLayoutWorker call');
  }
  get currentTime() {return this._currentTime;}
  export() {
    const result = [];

    result.push(['<comment ',
      '>'
    ].join(''));

    result.push(this._nakaGroup.export());
    result.push(this._topGroup.export());
    result.push(this._bottomGroup.export());

    result.push('</comment>');
    return result.join('\n');
  }
  getGroup(type) {
    switch (type) {
      case NicoChat.TYPE.TOP:
        return this._topGroup;
      case NicoChat.TYPE.BOTTOM:
        return this._bottomGroup;
      default:
        return this._nakaGroup;
    }
  }
  get bulkLayoutData() {
    return {
      top: this._topGroup.bulkLayoutData,
      naka: this._nakaGroup.bulkLayoutData,
      bottom: this._bottomGroup.bulkLayoutData
    };
  }
  set bulkLayoutData(data) {
    this._topGroup.bulkLayoutData = data.top;
    this._nakaGroup.bulkLayoutData = data.naka;
    this._bottomGroup.bulkLayoutData = data.bottom;
  }
}
//===END===

export {NicoCommentViewModel};