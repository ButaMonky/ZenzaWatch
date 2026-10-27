/**
 * Canonical TypeScript source for src/CommentPlayer.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const Config: Loose;
declare const Emitter: Loose;
declare const NicoChat: Loose;
declare const NicoChatFilter: Loose;
declare const NicoChatGroup: Loose;
declare const NicoChatGroupViewModel: Loose;
declare const NicoChatViewModel: Loose;
declare const NicoComment: Loose;
declare const NicoCommentCss3PlayerView: Loose;
declare const NicoCommentViewModel: Loose;
declare const OffscreenLayer: Loose;
declare const ZenzaCommentHistoryCore: Loose;
declare const _: Loose;
declare const global: Loose;


//@require NicoChat
//@require NicoChatViewModel
//@require NicoChatCss3View
//@require NicoChatFilter

class NicoCommentPlayer extends Emitter {
  declare emit: Loose;
  declare emitResolve: Loose;
  declare _commentHistoryRenderer: Loose;
  declare _model: Loose;
  declare _view: Loose;
  declare _viewModel: Loose;
  constructor(params?: Loose) {
    super();

    this._model = new NicoComment(params);
    this._viewModel = new NicoCommentViewModel(this._model);
    this._view = new NicoCommentCss3PlayerView({
      viewModel: this._viewModel,
      playbackRate: params.playbackRate,
      show: params.showComment,
      opacity: _.isNumber(params.commentOpacity) ? params.commentOpacity : 1.0
    });
    // Task 206: 同時表示上限の優先度で「増量で追加した過去コメント」を判別する。
    // NicoChatへフラグを足さず、CommentHistoryRendererが保持している集合を参照する。
    this._view.setHistoryClassifier((viewModel?: Loose) => {
      const renderer = this._commentHistoryRenderer;
      return !!(renderer && renderer.has(viewModel && viewModel._nicoChat));
    });

    const onCommentChange = _.throttle(this._onCommentChange.bind(this), 1000);
    this._model.on('change', onCommentChange);
    this._model.on('filterChange', this._onFilterChange.bind(this));
    this._model.on('parsed', this._onCommentParsed.bind(this));
    this._model.on('command', this._onCommand.bind(this));
    global.emitter.on('commentLayoutChange', onCommentChange);

    global.debug.nicoCommentPlayer = this;
    this.emitResolve('GetReady!');
  }
  setComment(data?: Loose, options?: Loose) {
    if (!options?.append) { this._commentHistoryRenderer?.reset(); }
    if (typeof data === 'string') {
      if (options.format === 'json') {
        this._model.setData(JSON.parse(data), options);
      } else {
        this._model.setXml(new DOMParser().parseFromString(data, 'text/xml'), options);
      }
    } else if (typeof data.getElementsByTagName === 'function') {
      this._model.setXml(data, options);
    } else if (options.format === 'threads') {
      this._model.setThreads(data, options);
    } else {
      this._model.setData(data, options);
    }
  }
  _onCommand(command?: Loose, param?: Loose) {
    this.emit('command', command, param);
  }
  _onCommentChange(e?: Loose) {
    console.log('onCommentChange', e);
    if (this._view) {
      setTimeout(() => this._view.refresh(), 0);
    }
    this.emit('change');
  }
  _onFilterChange(nicoChatFilter?: Loose) {
    this.emit('filterChange', nicoChatFilter);
  }
  _onCommentParsed() {
    this.emit('parsed');
  }
  getMymemory() {
    if (!this._view) {
      this._view = new NicoCommentCss3PlayerView({
        viewModel: this._viewModel
      });
    }
    return this._view.export();
  }
  set currentTime(sec: Loose) {this._model.currentTime=sec;}
  get currentTime() {return this._model.currentTime;}
  set vpos(vpos: Loose) {this._model.currentTime=vpos / 100;}
  get vpos() {return this._model.currentTime * 100;}

  setVisibility(v?: Loose) {
    if (v) {
      this._view.show();
    } else {
      this._view.hide();
    }
  }
  addChat(text?: Loose, cmd?: Loose, vpos?: Loose, options?: Loose) {
    if (typeof vpos !== 'number') {
      vpos = this.vpos;
    }
    const nicoChat = NicoChat.create(Object.assign({text, cmd, vpos}, options));
    this._model.addChat(nicoChat);

    return nicoChat;
  }
  applyHistoryThreads(data?: Loose, control?: Loose) {
    if (!this._commentHistoryRenderer) {
      this._commentHistoryRenderer = new ZenzaCommentHistoryCore.CommentHistoryRenderer({
        player: this, Chat: NicoChat, ChatViewModel: NicoChatViewModel
      });
    }
    return this._commentHistoryRenderer.apply(data, control);
  }
  clearCommentHistory() { this._commentHistoryRenderer?.clear(); }
  removeChat(nicoChat?: Loose) {
    this._commentHistoryRenderer?.removed(nicoChat);
    this._model.removeChat(nicoChat);
  }
  set playbackRate(v: Loose) {
    if (this._view) {
      this._view.playbackRate = v;
    }
  }
  get playbackRate() {
    if (this._view) { return this._view.playbackRate; }
    return 1;
  }
  setAspectRatio(ratio?: Loose) {
    this._view.setAspectRatio(ratio);
  }
  appendTo(node?: Loose) {
    this._view.appendTo(node);
  }
  show() {
    this._view.show();
  }
  hide() {
    this._view.hide();
  }
  close() {
    this._commentHistoryRenderer?.reset();
    this._model.clear();
    if (this._view) {
      this._view.clear();
    }
  }
  /**
   * @returns {NicoChatFilter}
   */
  get filter() {return this._model.filter;}
  // getChatList() {return this._model.getChatList();}
  get chatList() {return this._model.chatList;}
  /**
   * NGフィルタなどのかかってない全chatを返す
   */
  get nonFilteredChatList() {return this._model.nonFilteredChatList;}
  get nonfilteredChatList() {return this.nonFilteredChatList;}
  // getNonfilteredChatList() {return this._model.getNonfilteredChatList();}
  export() {
    return this._viewModel.export();
  }
  getCurrentScreenHtml() {
    return this._view.getCurrentScreenHtml();
  }
}

//@require NicoComment
//@require OffscreenLayer
NicoComment.offscreenLayer = OffscreenLayer(Config);
//@require NicoCommentViewModel
//@require NicoChatGroup
//@require NicoChatGroupViewModel


const updateSpeedRate = () => {
  let rate = Config.props.commentSpeedRate * 1;
  if (!Number.isFinite(rate) || rate <= 0) {
    rate = 1;
  }
  if (Config.props.autoCommentSpeedRate) {
    const playbackRate = Config.props.playbackRate * 1;
    rate = rate / (Number.isFinite(playbackRate) ? Math.max(playbackRate, 1) : 1);
  }
  // Imported settings and numeric underflow must not produce invalid durations.
  if (!Number.isFinite(rate) || rate <= 0) {
    rate = 1;
  }
  // window.console.info('updateSpeedRate', rate, Config.getValue('commentSpeedRate'), NicoChatViewModel.SPEED_RATE);
  if (rate !== NicoChatViewModel.SPEED_RATE) {
    NicoChatViewModel.SPEED_RATE = rate;
    NicoChatViewModel.emitter.emit('updateCommentSpeedRate', rate);
  }
};
Config.onkey('commentSpeedRate', updateSpeedRate);
Config.onkey('autoCommentSpeedRate', updateSpeedRate);
Config.onkey('playbackRate', updateSpeedRate);
updateSpeedRate();


//@require NicoCommentCss3PlayerView

Object.assign(global.debug, {
  NicoChat,
  NicoChatViewModel
});

export {
  NicoCommentPlayer,
  NicoComment,
  NicoCommentViewModel,
  NicoChatGroup,
  NicoChatGroupViewModel,
  NicoChat,
  NicoChatViewModel,
  NicoCommentCss3PlayerView,
  NicoChatFilter
};
