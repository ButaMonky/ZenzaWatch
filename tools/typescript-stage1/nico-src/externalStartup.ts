/**
 * Canonical TypeScript source for packages/zenza/src/init/externalStartup.js (Task851).
 */
export interface ExternalSiteStartup {
  host: string;
  pathname: string;
  initializePlayer: () => unknown;
  connect: () => unknown;
  readUser: (connected: unknown) => unknown;
  onError?: (error: unknown) => unknown;
}

const initializeExternalSite = ({
  host, pathname, initializePlayer, connect, readUser, onError = () => {}
}: ExternalSiteStartup) => {
  let started = false;
  const start = () => {
    if (started) { return Promise.resolve(); }
    started = true;
    return Promise.resolve().then(initializePlayer);
  };
  const isGoogleSearch = /^www\.google\.(?:com|co\.jp)$/.test(host) && pathname === '/search';
  if (isGoogleSearch) {
    // The hover button must appear even if the bridge never settles.
    start().catch(onError);
  }
  return Promise.resolve()
    .then(connect)
    .then(readUser)
    .catch(onError)
    .finally(start);
};

export {initializeExternalSite};
