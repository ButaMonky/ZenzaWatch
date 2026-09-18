import {PopupMessage} from '../util';
import {sleep} from '../../packages/lib/src/infra/sleep';
import {netUtil} from '../../../lib/src/infra/netUtil';

const debug = {};

//===BEGIN===

const {ThreadLoader} = (() => {
  const FRONT_ID = '6';
  const FRONT_VER = '0';

  const FORK_LABEL = {
    0: 'main',
    1: 'owner',
    2: 'easy',
    3: 'ai',
  }

  class ThreadLoader {

    constructor() {
      this._threadKeys = {};
    }

    async getThreadKey(videoId, options = {}) {
      let url = `https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=${videoId}`;

      console.log('getThreadKey url: ', url);
      try {
        const { meta, data } = await netUtil.fetch(url, {
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
          },
          credentials: 'include'
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
        this._threadKeys[videoId] = data.threadKey;
        return data
      } catch (result) {
        throw { result, message: `ThreadKeyの取得失敗 ${videoId}` }
      }
    }

    async getPostKey(threadId, options = {}) {
      const url = `https://nvapi.nicovideo.jp/v1/comment/keys/post?threadId=${threadId}`;

      console.log('getPostKey url: ', url);
      try {
        const { meta, data } = await netUtil.fetch(url, {
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
          },
          credentials: 'include'
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
        return data
      } catch (result) {
        throw { result, message: `PostKeyの取得失敗 ${threadId}` }
      }
    }

    async _delete(url, body, options = {}) {
      try {
        const { meta } = await netUtil.fetch(url, {
          method: 'PUT',
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
            'Content-Type': 'text/plain; charset=UTF-8'
          },
          body
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
      } catch (result) {
        throw {
          result,
          message: `コメントの通信失敗`
        }
      }
    }

    async _post(url, body, options = {}) {
      try {
        const { meta, data } = await netUtil.fetch(url, {
          method: 'POST',
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
            'Content-Type': 'text/plain; charset=UTF-8'
          },
          body
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
        return data;
      } catch (result) {
        throw {
          result,
          message: `コメントの通信失敗`
        }
      }
    }

    async _load(msgInfo, options = {}) {
      const {
        params,
        server,
        threadKey
      } = msgInfo.nvComment;

      // params は msgInfo.nvComment.params への参照そのもの。
      // ここで書き換えると msgInfo.nvComment.params 自体が汚染され、
      // 同じ msgInfo を使う次のリトライや reloadComment() にまで影響してしまうため、
      // 必ずコピーしてから使う（Task B-5）。
      const packet = {
        additionals: {},
        params: { ...params },
        threadKey
      };

      if (options.retrying) {
        const info = await this.getThreadKey(msgInfo.videoId, options);
        console.log('threadKey (retry): ', msgInfo.videoId, info);
        packet.threadKey = info.threadKey;
      }

      // ユーザーが選択している言語(en-us/zh-tw等)にコメントスレッドが
      // 対応していない動画に対して送ると errorCode=INVALID_PARAMETER で
      // 拒否される。この場合は同じ言語を送る限り何度リトライしても失敗し
      // 続けるため、直前の失敗が言語指定によるものだった場合は
      // サーバーが最初に返してきた既定言語(packet.params.language、
      // 通常は "ja-jp")にフォールバックする（Task B-5 追加調査）。
      if (!options.useServerDefaultLanguage && msgInfo.language && msgInfo.language !== packet.params.language) {
        packet.params.language = msgInfo.language;
      }

      if (msgInfo.when > 0) {
        packet.additionals.when = msgInfo.when;
      }

      const url = new URL('/v1/threads', server);
      console.log('load threads...', url, packet);
      try {
        const { meta, data } = await netUtil.fetch(url, {
          method: 'POST',
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
            'Content-Type': 'text/plain; charset=UTF-8'
          },
          body: JSON.stringify(packet)
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta;
        }
        // 実際にサーバーへ送った言語をload()側に伝え、フォールバックが
        // 発生した場合に msgInfo.language / threadInfo.language を
        // 実態に合わせて更新できるようにする（Task B-5 追加調査）。
        data.__usedLanguage = packet.params.language;
        return data;
      } catch (result) {
        // 400/INVALID_TOKEN 等が起きた時にすぐ切り分けられるよう、
        // ネストせず1行で status / errorCode を出す（Task B-5）。
        window.console.error(
          `_load threads fail: videoId=${msgInfo.videoId} status=${result && result.status} errorCode=${result && result.errorCode}`,
          result
        );
        throw {
          result,
          message: `コメントの通信失敗`
        }
      }
    }

    async load(msgInfo, options = {}) {
      const { videoId, userId } = msgInfo;

      const timeKey = `loadComment videoId: ${videoId}`;
      console.time(timeKey);

      // 動画を素早く切り替えた直後などは、サーバー側の一時的な不整合や
      // レート制限で400が続けて返ることがある。3秒1回だけのリトライでは
      // 足りないケースが報告された(Task B-5)ため、間隔を空けて2回リトライする。
      const RETRY_DELAYS_MS = [3000, 6000];

      let result;
      let lastError;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        const isRetry = attempt > 0;
        const loadOptions = isRetry ? { ...options, retrying: true } : options;
        // 直前の失敗が「言語指定が対象動画で無効」(INVALID_PARAMETER)による
        // ものだった場合、同じ言語で再試行しても必ず同じ結果になるため、
        // 今回のリトライではユーザー設定の言語指定をやめてサーバー既定の
        // 言語(ja-jp)にフォールバックする（Task B-5 追加調査）。
        if (isRetry && lastError && lastError.result && lastError.result.errorCode === 'INVALID_PARAMETER') {
          loadOptions.useServerDefaultLanguage = true;
        }
        try {
          if (isRetry) {
            console.time(timeKey);
          }
          result = await this._load(msgInfo, loadOptions);
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          console.timeEnd(timeKey);
          const label = isRetry ? `リトライ${attempt}回目` : '1回目';
          window.console.error(`loadComment fail (${label}): `, e);

          const delay = RETRY_DELAYS_MS[attempt];
          if (delay != null) {
            PopupMessage.alert(`コメントの取得失敗: ${delay / 1000}秒後にリトライ`);
            await sleep(delay);
          }
        }
      }

      if (lastError) {
        window.console.error('loadComment fail finally: ', lastError);
        throw {
          message: 'コメントサーバーの通信失敗',
          result: lastError.result
        };
      }

      console.timeEnd(timeKey);
      debug.lastMessageServerResult = result;

      // 選択言語が対象動画で使えず、既定言語にフォールバックして
      // 成功した場合は、以降 threadInfo や次回の再取得(reloadComment等)が
      // 実態と食い違わないよう msgInfo.language 自体を書き換える
      // （Task B-5 追加調査）。
      if (result.__usedLanguage && msgInfo.language && result.__usedLanguage !== msgInfo.language) {
        window.console.warn(
          `loadComment: 言語 "${msgInfo.language}" は videoId=${videoId} のスレッドで使用できないため、"${result.__usedLanguage}" にフォールバックしました`
        );
        PopupMessage.alert('この動画は選択中のコメント言語に対応していないため、既定の言語で表示します');
        msgInfo.language = result.__usedLanguage;
      }

      let totalResCount = result.globalComments.reduce((count, current) => (count + current.count), 0);
      for (const thread of result.threads) {
        const fork = thread.fork;
        thread.info = msgInfo.threads.find(({id, forkLabel}) => `${id}` === thread.id && forkLabel === fork);
        // 投稿者コメントはGlobalにカウントされていない
        if (fork === 'easy') {
          // かんたんコメントをカウントしていない挙動に合わせる。不要？
          const resCount = thread.commentCount;
          totalResCount -= resCount;
        }
      }

      const threadInfo = {
        userId,
        videoId,
        threadId: msgInfo.threadId,
        is184Forced: msgInfo.defaultThread.is184Forced,
        totalResCount,
        language: msgInfo.language,
        when: msgInfo.when,
        isWaybackMode: !!msgInfo.when
      };

      msgInfo.threadInfo = threadInfo;

      console.log('threadInfo: ', threadInfo);
      return {threadInfo, body: result, format: 'threads'};
    }

    async postChat(msgInfo, text, cmd, vpos, retrying = false) {
      const {
        videoId,
        threadId,
        language
      } = msgInfo.threadInfo;
      const url = new URL(`/v1/threads/${threadId}/comments`, msgInfo.nvComment.server);
      const { postKey } = await this.getPostKey(threadId, { language });

      const packet = JSON.stringify({
        body: text,
        commands: cmd?.split(/[\x20\xA0\u3000\t\u2003\s]+/) ?? [],
        vposMs: Math.floor((vpos || 0) * 10),
        postKey,
        videoId,
      });
      console.log('post packet: ', packet);
      try {
        const { no, id } = await this._post(url, packet);
        return {
          status: 'ok',
          no,
          id,
          message: 'コメント投稿成功'
        };
      } catch (error) {
        const { result: { status: statusCode, errorCode } } = error;
        if (statusCode == null) {
          throw {
            status: 'fail',
            message: `コメント投稿失敗`
          };
        }
        if (!retrying && ['INVALID_TOKEN', 'EXPIRED_TOKEN'].includes(errorCode)) {
          await this.load(msgInfo);
        } else {
          throw {
            status: 'fail',
            statusCode,
            message: errorCode ? `コメント投稿失敗 ${errorCode}` : 'コメント投稿失敗'
          };
        }
        await sleep(3000);
        return await this.postChat(msgInfo, text, cmd, vpos, true)
      }
    }

    async getDeleteKey(threadId, options = {}) {
      const url = `https://nvapi.nicovideo.jp/v1/comment/keys/delete?threadId=${threadId}&fork=${options.fork || 'main'}`;

      console.log('getNicoruKey url: ', url);
      try {
        const { meta, data } = await netUtil.fetch(url, {
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
            'X-Niconico-Language': options.language || 'ja-jp'
          },
          credentials: 'include'
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
        return data
      } catch (result) {
        throw { result, message: `DeleteKeyの取得失敗 ${threadId}` }
      }
    }

    async deleteChat(msgInfo, chat) {
      const {
        videoId,
        threadId,
        language
      } = msgInfo.threadInfo;
      const url = new URL(`/v1/threads/${threadId}/comment-comment-owner-deletions`, msgInfo.nvComment.server);
      const fork = FORK_LABEL[chat.fork || 0];
      const { deleteKey } = await this.getDeleteKey(threadId, { language, fork });
      const packet = JSON.stringify({
        deleteKey,
        fork,
        language,
        targets: [{
          no: chat.no,
          operation: 'DELETE'
        }],
        videoId,
      });
      console.log('put packet: ', packet);
      try {
        await this._delete(url, packet);
        return {
          status: 'ok',
          message: 'コメント削除成功'
        };
      } catch (error) {
        const { result: { status: statusCode, errorCode } } = error;
        throw {
          status: 'fail',
          statusCode,
          message: errorCode ? `コメント削除失敗 ${errorCode}` : 'コメント削除失敗'
        };
      }
    }

    async getNicoruKey(threadId, options = {}) {
      const url = `https://nvapi.nicovideo.jp/v1/comment/keys/nicoru?threadId=${threadId}`;

      console.log('getNicoruKey url: ', url);
      try {
        const { meta, data } = await netUtil.fetch(url, {
          headers: {
            'X-Frontend-Id': FRONT_ID,
            'X-Frontend-Version': FRONT_VER,
            'X-Niconico-Language': options.language || 'ja-jp'
          },
          credentials: 'include'
        }).then(res => res.json());
        if (meta.status >= 300) {
          throw meta
        }
        return data
      } catch (result) {
        throw { result, message: `NicoruKeyの取得失敗 ${threadId}` }
      }
    }

    async nicoru(msgInfo, chat) {
      const {
        videoId,
        threadId,
        language
      } = msgInfo.threadInfo;
      const url = new URL(`/v1/threads/${threadId}/nicorus`, msgInfo.nvComment.server);
      const { nicoruKey } = await this.getNicoruKey(threadId, { language });
      const packet = JSON.stringify({
        content: chat.text,
        fork: FORK_LABEL[chat.fork || 0],
        no: chat.no,
        nicoruKey,
        videoId,
      });
      console.log('post packet: ', packet);
      try {
        const { nicoruId, nicoruCount } = await this._post(url, packet);
        return {
          status: 'ok',
          id: nicoruId,
          count: nicoruCount,
          message: 'ニコれた'
        };
      } catch (error) {
        const { result: { status: statusCode, errorCode } } = error;
        throw {
          status: 'fail',
          statusCode,
          message: errorCode ? `ニコれなかった＞＜ ${errorCode}` : 'ニコれなかった＞＜'
        };
      }
    }
  }

  return {ThreadLoader: new ThreadLoader};
})();




//===END===

export {ThreadLoader};
