import {HistoryError, normalizeWatch, validateThreads, integerOption} from './core.mjs';

const ZENZA_FORKS = Object.freeze({main:0,owner:1,easy:2});
function seedError(code) { throw new HistoryError(code); }
function freezeSeedData(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeSeedData(child);
    Object.freeze(value);
  }
  return value;
}
function copyThreadDescriptor(info) {
  if (!info || !Object.hasOwn(ZENZA_FORKS, info.forkLabel) ||
      info.fork !== ZENZA_FORKS[info.forkLabel] || typeof info.label !== 'string' ||
      !Number.isSafeInteger(info.layer?.index) || info.layer.index < 0) seedError('THREAD_METADATA');
  // Only rendering metadata is copied. Do not carry msgInfo, post keys or mutable loader state.
  const out = {id:String(info.id),fork:info.fork,forkLabel:info.forkLabel,label:info.label,
    layer:{index:info.layer.index}};
  if (typeof info.layer.isTranslucent === 'boolean') out.layer.isTranslucent = info.layer.isTranslucent;
  return out;
}

/** Seed the existing history engine from a SUCCESSFUL normal Zenza load.
 * No network request, posting, renderer update, currentTime change or Config import occurs here.
 * Baseline contains real comment data in production; it must NOT be logged as diagnostics.
 */
export function createZenzaSeed({videoInfo,normalResult,playbackGeneration,normalRevision} = {}) {
  if (typeof playbackGeneration !== 'string' || !playbackGeneration) seedError('OPTION');
  integerOption(normalRevision,1,Number.MAX_SAFE_INTEGER);
  if (normalResult?.format !== 'threads' || !normalResult.threadInfo || !normalResult.body) seedError('UNSUPPORTED_FORMAT');
  const msg = videoInfo?.msgInfo, resultInfo = normalResult.threadInfo;
  if (!msg || typeof videoInfo.videoId !== 'string') seedError('VIDEO_MISSING');
  const videoId = videoInfo.videoId;
  if (msg.videoId !== videoId || resultInfo.videoId !== videoId) seedError('VIDEO_MISMATCH');
  const rawWhen = resultInfo.when ?? 0;
  const isWaybackMode = resultInfo.isWaybackMode === true;
  let historyStartWhen = null;
  if (isWaybackMode) {
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(rawWhen) || rawWhen <= 0 || rawWhen > now) seedError('UNSUPPORTED_WAYBACK');
    historyStartWhen = rawWhen;
  } else if (rawWhen !== 0) {
    // A dated response must explicitly identify itself as wayback; do not guess the mode.
    seedError('UNSUPPORTED_WAYBACK');
  }
  const language = normalResult.body.__usedLanguage ?? resultInfo.language;
  if (typeof language !== 'string' || !/^[a-z]{2}-[a-z]{2}$/i.test(language)) seedError('LANGUAGE_MISSING');
  const nv = msg.nvComment;
  const context = normalizeWatch({video:{id:videoId},comment:{nvComment:{
    server:nv?.server,threadKey:nv?.threadKey,params:{targets:nv?.params?.targets,language}
  }}},videoId);
  const watchId = String(videoInfo.contextWatchId ?? videoInfo.watchId ?? videoId);
  if (!/^(?:(?:sm|so|nm))?\d+$/.test(watchId)) seedError('WATCH_ID');
  if (!Number.isFinite(videoInfo.duration) || videoInfo.duration < 0) seedError('DURATION');
  if (!Array.isArray(msg.threads)) seedError('THREAD_METADATA');
  const descriptors = new Map();
  for (const target of context.targets) {
    const found = msg.threads.filter(t => String(t.id) === target.id && t.forkLabel === target.fork);
    if (found.length !== 1) seedError('THREAD_METADATA');
    descriptors.set(JSON.stringify([target.id,target.fork]),copyThreadDescriptor(found[0]));
  }
  const baseline = validateThreads({meta:{status:200},data:{threads:normalResult.body.threads}},context);
  const mainThreadId = resultInfo.threadId ?? null;
  if (mainThreadId !== null && !context.targets.some(t=>t.id===String(mainThreadId))) seedError('THREAD_METADATA');
  return freezeSeedData({context,
    identity:{videoId,watchId,language,playbackGeneration,normalRevision},baseline,historyStartWhen,
    render:{duration:videoInfo.duration,mainThreadId,threads:[...descriptors.values()]}
  });
}

/** Convert a full normal+history snapshot to Zenza's thread rendering input.
 * This is data conversion only, NOT an instruction to invoke normal-load success or append.
 * Current totals, posting state and wayback state are deliberately absent from the output.
 */
export function toZenzaThreads(seed, threads) {
  if (!seed?.context || !Array.isArray(seed.render?.threads)) seedError('OPTION');
  const copied = validateThreads({meta:{status:200},data:{threads}},seed.context);
  return {threads:copied.map(thread=>{
    const info = seed.render.threads.find(t=>t.id===thread.id && t.forkLabel===thread.fork);
    if (!info) seedError('THREAD_METADATA');
    return {...thread,info:{...info,layer:{...info.layer}}};
  })};
}
