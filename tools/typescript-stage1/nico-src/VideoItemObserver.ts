/**
 * Task515: boundary from thumbnail API payload to video-item observer UI.
 * The API result remains unknown; property probes intentionally retain legacy
 * JS coercion and failure-class behavior (including malformed response values).
 */
interface ThumbInfoProbe { status?: unknown; code?: string; [key: string]: unknown }
declare const ThumbInfoLoader: {load(watchId: string | undefined): Promise<unknown>};
declare const _: {throttle(fn: () => void, delay: number): () => void};
declare global {
  interface Window {
    IntersectionObserver: typeof IntersectionObserver;
    MutationObserver: typeof MutationObserver;
  }
}
export interface VideoItemObserveOptions {
  query?: string;
  container?: Element;
}
const VideoItemObserver = (() => {
  let intersectionObserver: IntersectionObserver | undefined;
  const mutationMap = new WeakMap<Element, MutationObserver>();
  const onItemInview = async (item: HTMLElement, watchId: string | undefined): Promise<void> => {
    const result = (await ThumbInfoLoader.load(watchId).catch(() => null)) as ThumbInfoProbe | null;
    item.classList.remove('is-fetch-current');
    if (!result || result.status === 'fail' || result.code === 'DELETED') {
      if (result && result.code !== 'COMMUNITY') {
      }
      item.classList.add('is-fetch-failed', (result) ? result.code as string : 'is-no-data');
    } else {
      item.dataset.thumbInfo = JSON.stringify(result);
    }
  };

  const initIntersectionObserver = (onItemInview: (item: HTMLElement, watchId: string | undefined) => void): IntersectionObserver => {
    if (intersectionObserver) {
      return intersectionObserver;
    }
    const _onInview = (item: HTMLElement): void => {
      item.classList.add('is-fetch-current');
      onItemInview(item, item.dataset.videoId);
    };
    intersectionObserver = new window.IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(entry => {
        const item = entry.target as HTMLElement;
        intersectionObserver!.unobserve(item);
        _onInview(item);
      });
    }, { rootMargin: '200px' });
    return intersectionObserver;
  };
  const initMutationObserver = ({query, container}: {query: string; container: Element}): MutationObserver => {
    let mutationObserver = mutationMap.get(container);
    if (mutationObserver) {
      return mutationObserver;
    }
    const update = (): void => {
      const items = (container || document).querySelectorAll<HTMLElement>(query);
      if (!items || items.length < 1) { return; }
      if (!items || items.length < 1) { return; }
      for (const item of items) {
        if (item.classList.contains('is-fetch-ignore')) { continue; }
        item.classList.add('is-fetch-wait');
        intersectionObserver!.observe(item);
      }
    };
    const onUpdate = _.throttle(update, 1000);
    mutationObserver = new MutationObserver(mutations => {
      const isAdded = mutations.find(
        mutation => mutation.addedNodes && mutation.addedNodes.length > 0);
      if (isAdded) { onUpdate(); }
    });
    mutationObserver.observe(
      container,
      {childList: true, characterData: false, attributes: false, subtree: true}
    );
    mutationMap.set(container, mutationObserver);
    return mutationObserver;
  };
  const observe = ({query, container}: VideoItemObserveOptions = {}): void => {
    if (!window.IntersectionObserver || !window.MutationObserver) {
      return;
    }
    if (!container) {
      return;
    }
    query = query || 'zenza-video-item';
    initIntersectionObserver(onItemInview);
    initMutationObserver({query, container});
  };
  const unobserve = ({container}: {container: Element}): void => {
    let mutationObserver = mutationMap.get(container);
    if (!mutationObserver) {
      return;
    }
    mutationObserver.disconnect();
    mutationMap.delete(container);
  };
  return {observe, unobserve};
})();
export {VideoItemObserver};
