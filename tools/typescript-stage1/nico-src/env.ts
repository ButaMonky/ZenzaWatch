/**
 * Canonical TypeScript source for packages/lib/src/infra/env.js (Task726).
 * User agent / plugin sniffing helpers.
 */
const env = {
  hasFlashPlayer(): boolean {
    return !!(navigator.mimeTypes as unknown as Record<string, MimeType | undefined>)['application/x-shockwave-flash'];
  },
  isEdgePC(): boolean {
    return navigator.userAgent.toLowerCase().includes('edge');
  },
  isFirefox(): boolean {
    return navigator.userAgent.toLowerCase().includes('firefox');
  },
  isWebkit(): boolean {
    return !this.isEdgePC() && navigator.userAgent.toLowerCase().includes('webkit');
  },
  isChrome(): boolean {
    return !this.isEdgePC() && navigator.userAgent.toLowerCase().includes('chrome');
  }
};

export {env};
