// import {browser} from './browser';
// GENERATED FROM tools/typescript-stage1/nico-src/env.ts (Task726). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/infra/env.js (Task726).
 * User agent / plugin sniffing helpers.
 */
const env = {
    hasFlashPlayer() {
        return !!navigator.mimeTypes['application/x-shockwave-flash'];
    },
    isEdgePC() {
        return navigator.userAgent.toLowerCase().includes('edge');
    },
    isFirefox() {
        return navigator.userAgent.toLowerCase().includes('firefox');
    },
    isWebkit() {
        return !this.isEdgePC() && navigator.userAgent.toLowerCase().includes('webkit');
    },
    isChrome() {
        return !this.isEdgePC() && navigator.userAgent.toLowerCase().includes('chrome');
    }
};
//===END===
export {env};
