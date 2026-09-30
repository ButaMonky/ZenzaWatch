// Task 099 / D-24: 存在しない動画IDカードから再生系commandを発火しない回帰テスト。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {createContext, loadClass} = require('../helpers/extractSource');

function subject() {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: 'https://www.nicovideo.jp/'
  });
  const w = dom.window;
  const dispatched = [];
  w.setTimeout = () => 0;

  class Emitter {}
  const c = createContext({
    Emitter,
    window: w,
    document: w.document,
    domEvent: {
      dispatchCommand: (...args) => dispatched.push(args)
    }
  });
  const VideoSearchForm = loadClass(
    'src/VideoInfoPanel.js', 'VideoSearchForm', c
  );
  const form = {
    _videoIdCards: new Map(),
    _view: w.document.body,
    _videoIdKey: '',
    _videoIdDismissedKey: '',
    _updateVideoIdPreview: () => {}
  };

  const createCard = watchId => {
    const card = w.document.createElement('div');
    card.className = 'searchVideoCard is-loading';
    card.dataset.watchId = watchId;
    card.innerHTML = [
      '<div class="searchVideoCard-title"></div>',
      '<div class="searchVideoCard-meta"></div>',
      '<button class="searchVideoCard-button is-primary" data-action="open">再生</button>'
    ].join('');
    form._videoIdCards.set(watchId, card);
    return card;
  };

  const fail = (card, watchId, code) =>
    VideoSearchForm.prototype._failVideoCard.call(
      form, card, watchId, {code}
    );
  const exec = (action, watchId) =>
    VideoSearchForm.prototype._execVideoIdAction.call(
      form, action, watchId, cardButton(form, watchId)
    );
  const close = () => w.close();
  return {form, dispatched, createCard, fail, exec, close};
}

function cardButton(form, watchId) {
  const card = form._videoIdCards.get(watchId);
  return card && card.querySelector('.searchVideoCard-button');
}

describe('動画IDプレビュー: 存在しない動画を操作しない（D-24 / Task 099）', function() {
  it('NOT_FOUND / DELETED は全ての再生系actionを発火しない', function() {
    for (const code of ['NOT_FOUND', 'DELETED']) {
      const s = subject();
      const id = code === 'NOT_FOUND' ? 'sm245' : 'sm99999999';
      const card = s.createCard(id);
      s.fail(card, id, code);
      assert.ok(card.classList.contains('is-unavailable'));
      assert.equal(card.getAttribute('aria-disabled'), 'true');
      assert.ok([...card.querySelectorAll('.searchVideoCard-button')].every(button => button.disabled));

      for (const action of ['open', 'playlistInsert', 'playlistAdd', 'deflistAdd']) {
        s.exec(action, id);
      }
      assert.equal(s.dispatched.length, 0, `${code} なのに command が発火した`);
      s.close();
    }
  });

  it('COMMUNITY 等の取得失敗は従来どおり「再生は試せる」', function() {
    const s = subject();
    const id = 'sm123';
    const card = s.createCard(id);
    s.fail(card, id, 'COMMUNITY');
    assert.ok(!card.classList.contains('is-unavailable'));

    s.exec('open', id);
    assert.equal(s.dispatched.length, 1);
    assert.equal(s.dispatched[0][1], 'open');
    assert.equal(s.dispatched[0][2], id);
    s.close();
  });
});
