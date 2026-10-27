// Initialize the external-domain player without making Google search wait
// for the cross-domain configuration/login bridge (which may be blocked).
//===BEGIN===
const initializeExternalSite = ({
  host, pathname, initializePlayer, connect, readUser, onError = () => {}
}) => {
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
//===END===
export {initializeExternalSite};
