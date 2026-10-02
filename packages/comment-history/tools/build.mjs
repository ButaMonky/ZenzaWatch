import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=['core.mjs','transport.mjs','history.mjs','probe.mjs','userscript-ui.js'];
const header=`// ==UserScript==
// @name         Nico Comment History - 独立取得診断
// @namespace    local:nico-comment-history-probe
// @version      0.1.0
// @description  手動開始・最大5回の取得互換性診断。描画/投稿/Zenza設定を変更せず、集計JSONだけを保存。
// @match        https://www.nicovideo.jp/watch/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==
`;
const code=modules.map(name=>`// --- ${name} ---\n`+fs.readFileSync(path.join(root,'src',name),'utf8')
 .replace(/^import .*? from ['"].*?['"];?\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
if(/^import\s|^export\s/m.test(code))throw new Error('Unresolved module syntax');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','NicoCommentHistory-Probe.user.js'),header+`\n(function(){\n'use strict';\n${code}\n})();\n`);
console.log('Built dist/NicoCommentHistory-Probe.user.js');

const standaloneModules=['core.mjs','transport.mjs','settings.mjs','layers.mjs','coordinator.mjs','session.mjs','standalone-ui.js'];
const standaloneHeader=header.replace('Nico Comment History - 独立取得診断','Nico Comment History - 独立取得')
 .replace('local:nico-comment-history-probe','local:nico-comment-history-standalone')
 .replace('0.1.0','0.2.0')
 .replace('手動開始・最大5回の取得互換性診断。描画/投稿/Zenza設定を変更せず、集計JSONだけを保存。','上限付きの独立コメント取得。描画/投稿/Zenza設定は変更しない。設定と集計JSONのみ保存。')
 .replace('// @grant        GM_registerMenuCommand','// @grant        GM_registerMenuCommand\n// @grant        GM_getValue\n// @grant        GM_setValue');
const standaloneCode=standaloneModules.map(name=>`// --- ${name} ---\n`+fs.readFileSync(path.join(root,'src',name),'utf8')
 .replace(/^import .*? from ['"].*?['"];?\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
if(/^import\s|^export\s/m.test(standaloneCode))throw new Error('Unresolved standalone module syntax');
fs.writeFileSync(path.join(root,'dist','NicoCommentHistory-Standalone.user.js'),standaloneHeader+`\n(function(){\n'use strict';\n${standaloneCode}\n})();\n`);
console.log('Built dist/NicoCommentHistory-Standalone.user.js');
