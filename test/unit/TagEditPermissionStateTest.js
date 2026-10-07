'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function loadTagListView(rel = 'src/TagListView.js') {
  let loggedIn = true;
  class BaseViewComponent {
    setState(next) { Object.assign(this._state, next); }
    _onCommand() {}
  }
  class TagEditApi {}
  const textUtil = {
    escapeHtml: s => String(s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    escapeToZenkaku: s => s,
    unescapeHtml: s => s
  };
  const context = createContext({
    BaseViewComponent,
    TagEditApi,
    ZenzaWatch: {emitter: {on() {}, emit() {}}},
    NicodicArticleLoader: {checkAll() {}},
    parseVideoSearchSortValue: () => ({sort: 'playlist', order: 'd', playlistSort: 'playlist'}),
    Config: {namespace: () => ({getValue: () => 'playlist'})},
    textUtil,
    nicoUtil: {isLogin: () => loggedIn},
    document: {body: {addEventListener() {}, removeEventListener() {}}},
    window: {console, CSS: {escape: s => s}, setTimeout, clearTimeout},
    CSS: {escape: s => s}
  });
  run(`${extract(rel, 'TagListView')}; globalThis.Subject = TagListView;`, context);
  return {TagListView: context.Subject, setLoggedIn: v => { loggedIn = v; }};
}

function makeSubject(TagListView) {
  const subject = Object.create(TagListView.prototype);
  subject._state = {isInputing: false, isUpdating: false, isEditing: false};
  subject._elm = {
    videoTagsInner: {innerHTML: ''},
    videoTags: {querySelector() { return null; }},
    tagInput: {value: '', focus() {}, blur() {}}
  };
  subject._updateNicodicIcons = () => {};
  subject._genre = null;
  subject._inputFocusTimer = null;
  subject._boundOnBodyClick = () => {};
  return subject;
}

describe('Task262 tag edit permission state', () => {
  it('replaces editable state on every video, including missing tagEdit', () => {
    const {TagListView} = loadTagListView();
    const subject = makeSubject(TagListView);
    subject._update = () => {};

    subject.update({
      tagList: [],
      watchId: 'smA',
      videoId: 'smA',
      tagEdit: {isEditable: true, uneditableReason: null, editKey: 'old'}
    });
    assert.strictEqual(subject._canEditTags(), true);

    subject.update({
      tagList: [],
      watchId: 'smB',
      videoId: 'smB',
      tagEdit: {isEditable: false, uneditableReason: 'PREMIUM_ONLY', editKey: 'new'}
    });
    assert.strictEqual(subject._canEditTags(), false);
    assert.strictEqual(subject._tagEdit.uneditableReason, 'PREMIUM_ONLY');

    subject.update({tagList: [], watchId: 'smC', videoId: 'smC'});
    assert.strictEqual(subject._tagEdit, null);
    assert.strictEqual(subject._canEditTags(), false);
  });

  it('shows edit controls only for explicitly editable videos', () => {
    const {TagListView} = loadTagListView();
    const subject = makeSubject(TagListView);

    subject._tagEdit = {isEditable: true, uneditableReason: null};
    subject._update([{name: 'test-tag', isLocked: false}]);
    assert(subject._elm.videoTagsInner.innerHTML.includes('toggleInput'));
    assert(subject._elm.videoTagsInner.innerHTML.includes('data-command="removeTag"'));

    subject._tagEdit = {isEditable: false, uneditableReason: 'PREMIUM_ONLY'};
    subject._update([{name: 'test-tag', isLocked: false}]);
    assert(!subject._elm.videoTagsInner.innerHTML.includes('toggleInput'));
    assert(!subject._elm.videoTagsInner.innerHTML.includes('data-command="removeTag"'));
    assert(subject._elm.videoTagsInner.innerHTML.includes('プレミアム会員のみタグ編集できます'));
  });

  it('uses a generic message when edit metadata is missing or has an unknown reason', () => {
    const {TagListView} = loadTagListView();
    const subject = makeSubject(TagListView);

    subject._tagEdit = null;
    assert.strictEqual(subject._tagEditUnavailableMessage(), 'この動画ではタグ編集できません');

    subject._tagEdit = {isEditable: false, uneditableReason: 'UNKNOWN_REASON'};
    assert.strictEqual(subject._tagEditUnavailableMessage(), 'この動画ではタグ編集できません');
  });

  it('does not begin editing or input when the current video is not editable', () => {
    const {TagListView} = loadTagListView();
    const subject = makeSubject(TagListView);
    subject._tagEdit = {isEditable: false, uneditableReason: 'PREMIUM_ONLY'};

    subject._beginEdit();
    subject._beginInput();

    assert.strictEqual(subject._state.isEditing, false);
    assert.strictEqual(subject._state.isInputing, false);
  });

  it('does not send stale add/remove commands for a non-editable video', () => {
    const {TagListView} = loadTagListView();
    const subject = makeSubject(TagListView);
    let addCalls = 0;
    let removeCalls = 0;
    subject._tagEdit = {isEditable: false, uneditableReason: 'PREMIUM_ONLY'};
    subject._tagEditApi = {
      add() { addCalls += 1; },
      remove() { removeCalls += 1; }
    };

    subject._addTag('new-tag');
    subject._removeTag('old-tag', 'old-tag');

    assert.strictEqual(addCalls, 0);
    assert.strictEqual(removeCalls, 0);
    assert.strictEqual(subject._state.isUpdating, false);
  });

  it('keeps generated dev dist permission behavior in parity with source', () => {
    const {TagListView} = loadTagListView('dist/ZenzaWatch-dev.user.js');
    const subject = makeSubject(TagListView);

    subject._tagEdit = {isEditable: false, uneditableReason: 'PREMIUM_ONLY'};
    subject._update([{name: 'test-tag', isLocked: false}]);
    assert(!subject._elm.videoTagsInner.innerHTML.includes('toggleInput'));
    assert(!subject._elm.videoTagsInner.innerHTML.includes('data-command="removeTag"'));
    assert(subject._elm.videoTagsInner.innerHTML.includes('プレミアム会員のみタグ編集できます'));

    subject._update = () => {};
    subject.update({tagList: [], watchId: 'smB', videoId: 'smB'});
    assert.strictEqual(subject._tagEdit, null);
    assert.strictEqual(subject._canEditTags(), false);
  });
});
