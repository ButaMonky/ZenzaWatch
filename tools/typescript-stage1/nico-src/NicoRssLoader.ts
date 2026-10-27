/** Task465: the legacy RSS XML/HTML parsing contract, without shape changes. */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;
declare const textUtil: {dateToString(date: Date): string};

export interface NicoRssItem {
  _format: 'nicorss';
  id: string;
  uniq_id: string;
  title: string | null;
  length_seconds: number;
  thumbnail_url: string;
  first_retrieve: string;
  description: string | null;
  num_res?: number;
  mylist_counter?: number;
  view_counter?: number;
}
export type NicoRssTerm = 'hour' | '24h' | 'week' | 'month' | 'total';
export interface NicoRssRankingOptions {
  genre?: string;
  term?: NicoRssTerm;
  tag?: string;
}
export interface NicoRssLoaderClient {
  load(url: string): Promise<NicoRssItem[]>;
  loadRanking(options: NicoRssRankingOptions): Promise<NicoRssItem[]>;
}

const NicoRssLoader: NicoRssLoaderClient = (() => {
  const parseItem = (item: Element): NicoRssItem => {
    const id = item.querySelector('link')!.textContent!.replace(/^.+\//, '');
    let watchId = id;
    const guid = item.querySelector('guid')!.textContent!;
    const desc = new DOMParser().parseFromString(item.querySelector('description')!.textContent!, 'text/html');
    const [min, sec] = desc.querySelector('.nico-info-length')!.textContent!.split(':');
    const dt = guid.match(/,([\d]+-[\d]+-[\d]+):/)![1];
    const tm = desc.querySelector('.nico-info-date')!.textContent!.replace(/[：]/g, ':').match(/([\d]+:[\d]+:[\d]+)/)![0];
    const date = new Date(`${dt} ${tm}`);
    const thumbnail_url = desc.querySelector<HTMLImageElement>('.nico-thumbnail img')!.src;
    const vm = thumbnail_url.match(/(\d+)\.(\d+)/);
    if (vm && /^\d+$/.test(id)) {
      watchId = `so${vm[1]}`;
    }

    const result: NicoRssItem = {
      _format: 'nicorss',
      id: watchId,
      uniq_id: id,
      title: item.querySelector('title')!.textContent,
      length_seconds: Number(min) * 60 + Number(sec) * 1,
      thumbnail_url,
      first_retrieve: textUtil.dateToString(date),
      description: desc.querySelector('.nico-description')!.textContent
    };
    if (desc.querySelector('.nico-info-total-res')) {
      Object.assign(result, {
        num_res: parseInt(desc.querySelector('.nico-info-total-res')!.textContent!.replace(/,/g, ''), 10),
        mylist_counter: parseInt(desc.querySelector('.nico-info-total-mylist')!.textContent!.replace(/,/g, ''), 10),
        view_counter: parseInt(desc.querySelector('.nico-info-total-view')!.textContent!.replace(/,/g, ''), 10)
      });
    }
    return result;
  };

  const load = async (url: string): Promise<NicoRssItem[]> => {
    const rssText = await netUtil.fetch(url).then(r => r.text());
    const xml = new DOMParser().parseFromString(rssText, 'application/xml');
    const items = Array.from(xml.querySelectorAll('item')).map(i => parseItem(i));
    return items;
  };

  const loadRanking = ({genre = 'all', term = 'hour', tag = ''}: NicoRssRankingOptions): Promise<NicoRssItem[]> => {
    const url = `https://www.nicovideo.jp/ranking/genre/${genre}?term=${term}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}&rss=2.0`;
    return load(url);
  };

  return {load, loadRanking};
})();

export {NicoRssLoader};
