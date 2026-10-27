// Task526: invalid external arguments must remain TypeScript errors.
import {createZenzaSeed,toZenzaThreads} from './zenza-context.js';
import type {ZenzaSeedOptions} from './zenza-context-types.js';
declare const valid:ZenzaSeedOptions;
const seed=createZenzaSeed(valid);
toZenzaThreads(seed,[]);
// @ts-expect-error generation IDs are not numbers
createZenzaSeed({...valid,playbackGeneration:123});
// @ts-expect-error normal revision is not an arbitrary string
createZenzaSeed({...valid,normalRevision:'latest'});
// @ts-expect-error render input consists of normalized comment threads, not strings
toZenzaThreads(seed,['raw-comment']);
