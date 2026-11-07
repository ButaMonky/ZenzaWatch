import {textUtil} from '../text/textUtil';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/NicoRssLoader.ts (Task465). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const NicoRssLoader = (() => {
    const parseItem = (item) => {
        const id = item.querySelector('link').textContent.replace(/^.+\//, '');
        let watchId = id;
        const guid = item.querySelector('guid').textContent;
        const desc = new DOMParser().parseFromString(item.querySelector('description').textContent, 'text/html');
        const [min, sec] = desc.querySelector('.nico-info-length').textContent.split(':');
        const dt = guid.match(/,([\d]+-[\d]+-[\d]+):/)[1];
        const tm = desc.querySelector('.nico-info-date').textContent.replace(/[：]/g, ':').match(/([\d]+:[\d]+:[\d]+)/)[0];
        const date = new Date(`${dt} ${tm}`);
        const thumbnail_url = desc.querySelector('.nico-thumbnail img').src;
        const vm = thumbnail_url.match(/(\d+)\.(\d+)/);
        if (vm && /^\d+$/.test(id)) {
            watchId = `so${vm[1]}`;
        }
        const result = {
            _format: 'nicorss',
            id: watchId,
            uniq_id: id,
            title: item.querySelector('title').textContent,
            length_seconds: Number(min) * 60 + Number(sec) * 1,
            thumbnail_url,
            first_retrieve: textUtil.dateToString(date),
            description: desc.querySelector('.nico-description').textContent
        };
        if (desc.querySelector('.nico-info-total-res')) {
            Object.assign(result, {
                num_res: parseInt(desc.querySelector('.nico-info-total-res').textContent.replace(/,/g, ''), 10),
                mylist_counter: parseInt(desc.querySelector('.nico-info-total-mylist').textContent.replace(/,/g, ''), 10),
                view_counter: parseInt(desc.querySelector('.nico-info-total-view').textContent.replace(/,/g, ''), 10)
            });
        }
        return result;
    };
    const load = async (url) => {
        const rssText = await netUtil.fetch(url).then(r => r.text());
        const xml = new DOMParser().parseFromString(rssText, 'application/xml');
        const entries = Array.from(xml.querySelectorAll('item'));
        const items = [];
        let skipped = 0;
        for (const entry of entries) {
            try {
                items.push(parseItem(entry));
            }
            catch (_) {
                skipped++;
            }
        }
        if (skipped > 0 && items.length === 0) {
            throw new Error('RSSの項目を解析できませんでした');
        }
        if (skipped > 0) {
            window.console.warn('RSSの形式不正の項目をスキップしました', skipped);
        }
        return items;
    };
    const loadRanking = ({ genre = 'all', term = 'hour', tag = '' }) => {
        const url = `https://www.nicovideo.jp/ranking/genre/${genre}?term=${term}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}&rss=2.0`;
        return load(url);
    };
    return { load, loadRanking };
})();
//===END===
export {NicoRssLoader};
