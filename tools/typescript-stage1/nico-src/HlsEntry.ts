/** Retirement notice only: playback is owned by the main script. */
(() => {
  const show = () => {
    if (document.getElementById('zenza-hls-retired-notice')) { return; }
    const box = document.createElement('aside');
    box.id = 'zenza-hls-retired-notice';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;top:16px;right:16px;max-width:380px;padding:18px;z-index:2147483647;background:#17212d;color:#eee;border:1px solid #64748b;border-radius:8px;font:14px/1.7 sans-serif;box-shadow:0 4px 24px #0008';
    const title = document.createElement('strong');
    title.textContent = 'HLSサポートはZenzaWatch本体に統合されました';
    const text = document.createElement('p');
    text.textContent = 'ZenzaWatch本体を2.7.373以降へ更新してから、この「ZenzaWatch HLS Support」スクリプトをTampermonkeyなどの管理画面から削除してください。HLS再生と保存済みの設定は本体が引き継ぎます。ZenzaWatch本体は削除しないでください。';
    const link = document.createElement('a');
    link.href = 'https://github.com/ButaMonky/ZenzaWatch/releases/latest';
    link.textContent = '本体を最新版に更新する';
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.color = '#91ded3';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '案内を閉じる';
    close.style.cssText = 'display:block;margin-top:12px;padding:5px 10px';
    close.addEventListener('click', () => box.remove());
    box.append(title, text, link, close); document.body.append(box);
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', show, {once:true}); }
  else { show(); }
})();

export {};
