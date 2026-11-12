"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPlayerBackground = installPlayerBackground;
/** The isolated player document must not paint over the host in small mode. */
function installPlayerBackground(document) {
    const style = document.createElement('style');
    style.dataset.zenzaExternalBackground = '';
    style.textContent = `
    html:has(body.zenzaScreenMode_small):not(:has(:fullscreen)),
    body.zenzaScreenMode_small:not(:has(:fullscreen)) {
      background: transparent !important;
    }
  `;
    document.head.append(style);
}
