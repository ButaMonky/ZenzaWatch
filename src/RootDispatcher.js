import {ZenzaWatch, PRODUCT} from './ZenzaWatchIndex';
import {PopupMessage} from './util';
import {PlayerConfig} from './NicoVideoPlayerDialog';
import {Clipboard} from '../packages/lib/src/dom/Clipboard';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {CommentPictureInPicture} from '../packages/zenza/src/commentLayer/CommentPictureInPicture';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
//===BEGIN===
//@require CommentPictureInPicture
const RootDispatcher = (() => {
  let config;
  let player;
  let playerState;
  class RootDispatcher {
    static initialize(dialog) {
      player = dialog;
      playerState = ZenzaWatch.state.player;
      config = PlayerConfig.getInstance(config);
      config.on('update', RootDispatcher.onConfigUpdate);
      player.on('command', RootDispatcher.execCommand);
      player.on('close', () => CommentPictureInPicture.stop());
    }

    static toggleCommentPictureInPicture() {
      const nicoVideoPlayer = player && player._nicoVideoPlayer;
      if (!nicoVideoPlayer) {
        return;
      }
      if (!CommentPictureInPicture.isSupported()) {
        PopupMessage.alert('このブラウザはコメント付きピクチャーインピクチャーに対応していません');
        return;
      }
      CommentPictureInPicture.toggle({
        config,
        getVideo: () => player._nicoVideoPlayer && player._nicoVideoPlayer.drawableVideoElement,
        getViewModel: () => player._nicoVideoPlayer && player._nicoVideoPlayer.commentViewModel,
        onPlay: () => player.execCommand('play'),
        onPause: () => player.execCommand('pause')
      }).catch(err => {
        console.warn('comment picture-in-picture fail', err);
        PopupMessage.alert(`コメント付きピクチャーインピクチャーを開始できませんでした: ${err && err.message || err}`);
      });
    }

    static execCommand(command, params) {
      let result = {status: 'ok'};
      switch(command) {
        case 'notifyHtml':
          PopupMessage.notify(params, true);
          break;
        case 'notify':
          PopupMessage.notify(params);
          break;
        case 'alert':
          PopupMessage.alert(params);
          break;
        case 'alertHtml':
          PopupMessage.alert(params, true);
          break;
        case 'copy-video-watch-url':
          Clipboard.copyText(playerState.videoInfo.watchUrl);
          break;
        case 'tweet':
          nicoUtil.openTweetWindow(playerState.videoInfo);
          break;
        // Task 060: 関連メニュー(RelatedInfoMenu、VideoInfoPanel.js内)の
        // 「ニコニ広告で宣伝」「twitterの反応を見る」「親作品・コンテンツ
        // ツリー」と同じURLをキーボードショートカットからも開けるように
        // する。URLの組み立て方はRelatedInfoMenu._onCommand()の該当箇所と
        // 完全に同じにしてあり、そちら側のコード・挙動は一切変更していない
        // （あちらはクリック時にそのパネルが持つ動画IDから作るのに対し、
        // こちらは現在再生中の動画のplayerState.videoInfo.videoIdから作る、
        // という参照元が違うだけ）。
        case 'open-uad': {
          const uadVideoId = playerState.videoInfo && playerState.videoInfo.videoId;
          if (!uadVideoId) { break; }
          const uadUrl = `//nicoad.nicovideo.jp/video/publish/${uadVideoId}?frontend_id=6&frontend_version=0&zenza_watch`;
          window.open(uadUrl, '', 'width=428, height=600, toolbar=no, scrollbars=1');
          break;
        }
        case 'open-twitter-hash': {
          const hashVideoId = playerState.videoInfo && playerState.videoInfo.videoId;
          if (!hashVideoId) { break; }
          window.open(`https://twitter.com/hashtag/${hashVideoId}`);
          break;
        }
        case 'open-parent-video': {
          const parentVideoId = playerState.videoInfo && playerState.videoInfo.videoId;
          if (!parentVideoId) { break; }
          window.open(`//commons.nicovideo.jp/works/${parentVideoId}?transit_from=pcvideo_watch_contentstree&rf=nvpc&rp=watch&ra=content_tree`);
          break;
        }
        // Task 060: 「小」モードの位置・サイズを初期状態に戻す機能
        // （既存の.zenzaSmallModeResetButton、Task 032〜）を、キーボード
        // ショートカットからも実行できるようにする。位置・サイズの計算
        // ロジック自体は既存のボタンのクリックハンドラ内に閉じたローカル
        // 変数で実装されているため複製せず、既存ボタンをプログラム的に
        // クリックさせることで同じ処理をそのまま再利用する。
        case 'resetSmallModePosition': {
          const resetBtn = document.querySelector('.zenzaSmallModeResetButton');
          if (resetBtn) { resetBtn.click(); }
          break;
        }
        case 'export-config':
          config.exportToFile();
          break;
        case 'toggleConfig': {
          config.props[params] = !config.props[params];
          break;
        }
        case 'picture-in-picture':
          CommentPictureInPicture.stop();
          document.querySelector('.zenzaWatchVideoElement').requestPictureInPicture();
          break;
        // Task 070: 流れるコメントも一緒に映るPiP（もう一度実行すると閉じる）
        case 'picture-in-picture-comment':
          RootDispatcher.toggleCommentPictureInPicture();
          break;
        case 'toggle-comment':
        case 'toggle-showComment':
        case 'toggle-backComment':
        case 'toggle-mute':
        case 'toggle-loop':
        case 'toggle-debug':
        case 'toggle-enableFilter':
        case 'toggle-enableNicosJumpVideo':
        case 'toggle-useWellKnownPort':
        case 'toggle-bestZenTube':
        case 'toggle-autoCommentSpeedRate':
        case 'toggle-video.hls.enableOnlyRequired':
        // Task 059: ショートカットキー設定の拡張で追加した、新しい
        // トグル系ショートカット向けのcase(14件)。挙動は既存のcaseと
        // 全く同じ(configの真偽値を反転するだけの)汎用処理。
        case 'toggle-enableStoryboard':
        case 'toggle-enableStoryboardBar':
        case 'toggle-enableCommentPanel':
        case 'toggle-enableCommentPanelAutoScroll':
        case 'toggle-enableHeatMap':
        case 'toggle-enableAdDecoration':
        case 'toggle-autoPlay':
        case 'toggle-continueNextPage':
        case 'toggle-autoZenTube':
        case 'toggle-enableDblclickClose':
        case 'toggle-smallModeAspectLock':
        case 'toggle-enableFullScreenOnDoubleClick':
        case 'toggle-removeNgMatchedUser':
        case 'toggle-enableCommentPreview':
        // Task 074: 音声の自動調整
        case 'toggle-audio.autoAdjust':
          command = command.replace(/^toggle-/, '');
          config.props[command] = !config.props[command];
          break;
        case 'baseFontFamily':
        case 'baseChatScale':
        case 'enableFilter':
        case 'update-enableFilter':
        case 'screenMode':
        case 'update-screenMode':
        case 'update-sharedNgLevel':
        case 'update-commentSpeedRate':
        case 'update-fullscreenControlBarMode':
          command = command.replace(/^update-/, '');
          if (config.props[command] === params) {
            break;
          }
          config.props[command] = params;
          break;

        case 'nop':
          break;
        case 'echo':
          window.console.log('%cECHO', 'font-weight: bold;', {params});
          PopupMessage.notify(`ECHO: 「${typeof params === 'string' ? params : JSON.stringify(params)}」`);
          break;
        default:
          // Task 077: 画面フィルター（toggle-screenFilter.* / screenFilter-*）
          if (typeof command === 'string' && /^(toggle-)?screenFilter[.-]/.test(command)) {
            const message = ScreenFilter.execCommand(command, params);
            message && PopupMessage.notify(message);
            break;
          }
          ZenzaWatch.emitter.emit(`command-${command}`, command, params);
          window.dispatchEvent(new CustomEvent(`${PRODUCT}-command`, {detail: {command, params, param: params}}));
      }
      return result;
    }

    static onConfigUpdate(key, value) {
      switch (key) {
        case 'enableFilter':
          playerState.isEnableFilter = value;
          break;
        case 'backComment':
          playerState.isBackComment = !!value;
          break;
        case 'showComment':
          playerState.isShowComment = !!value;
          break;
        case 'loop':
          playerState.isLoop = !!value;
          break;
        case 'mute':
          playerState.isMute = !!value;
          break;
        case 'debug':
          playerState.isDebug = !!value;
          PopupMessage.notify('debug: ' + (value ? 'ON' : 'OFF'));
          break;
        case 'sharedNgLevel':
        case 'screenMode':
        case 'playbackRate':
          playerState[key] = value;
          break;
      }
    }
  }
  return RootDispatcher;
})();
//===END===
export {RootDispatcher};
