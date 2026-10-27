// Task508: static consumer contract, including untrusted page-header boundary.
import {nicoUtil} from '../nico-src/nicoUtil';

const parsed = nicoUtil.parseWatchQuery('playlist=...');
const playlist: unknown = parsed.playlist;
const watchId: string | null = nicoUtil.getWatchId('https://nico.ms/sm9');
const thumbnail: string | null = nicoUtil.getThumbnailUrlByVideoId('sm9');
const language: string = nicoUtil.getPageLanguage();
const history: string = nicoUtil.getNicoHistory;
const header: unknown = nicoUtil.getCommonHeader();
void [playlist, watchId, thumbnail, language, history, header];

// @ts-expect-error video IDs must be text
nicoUtil.hasLargeThumbnail(2);
// @ts-expect-error cannot assume an unvalidated page header has a user
nicoUtil.getCommonHeader().initConfig.user;
// @ts-expect-error Tweet inputs must provide required metadata
nicoUtil.openTweetWindow({watchId:'sm9',title:'title'});
// @ts-expect-error getWatchId is not a parsed URL object API
nicoUtil.getWatchId(new URL('https://nico.ms/sm9'));
