import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {textUtil} from '../text/textUtil';
import {netUtil} from '../infra/netUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/NicoRssLoader.ts (Task465). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
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
        const ticket = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin(url.startsWith('https://ch.nicovideo.jp/') ? 'channel-rss' : 'ranking-rss', url, 'response', undefined, undefined, { url, method: 'GET' });
        const response = await netUtil.fetch(url).catch(error => { ticket?.failure(error); throw error; });
        const rssText = await response.text().catch(error => { ticket?.failure(RequestDiagnostics.readFailure(response, error)); throw error; });
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
            ticket?.failure({ httpStatus: response.status, kind: 'schema', missing: 'rss.item' });
            throw new Error('RSSの項目を解析できませんでした');
        }
        if (skipped > 0) {
            window.console.warn('RSSの形式不正の項目をスキップしました', skipped);
        }
        if (response.status >= 400)
            ticket?.failure({ httpStatus: response.status });
        else if (ticket && (skipped || !xml.querySelector('rss > channel'))) {
            ticket?.failure({ ...RequestDiagnostics.responseEvidence(response), httpStatus: response.status,
                kind: 'schema', missing: skipped ? 'rss.item' : 'rss.channel' });
        }
        else
            ticket?.success();
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
