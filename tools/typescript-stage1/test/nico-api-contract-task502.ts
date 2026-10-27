// Task502: compile-only contract for post target selection.
import {CommentPostTarget} from '../nico-src/CommentPostTarget';
import type {PostTargetSelection, PostThreadCandidate} from '../nico-src/CommentPostTarget';

const entries = [{id: 7, isDefaultPostTarget: true}, {id: 8, isDefaultPostTarget: false}];
const selection = CommentPostTarget.select(entries, []);
const valid: PostTargetSelection<typeof entries[number]> = selection;
const canPost: boolean = valid.canPost;
const defaultThread: typeof entries[number] | null = valid.defaultThread;
const optionalThreads: typeof entries = valid.optionalThreads;
void canPost; void defaultThread; void optionalThreads;
const uncertainThreadId: unknown = selection.threadId;
void uncertainThreadId;
// @ts-expect-error raw external thread ID cannot be trusted to be a number
const unvalidatedId: number = selection.threadId;
void unvalidatedId;
const unknownEntry: PostThreadCandidate = {id: null, isDefaultPostTarget: 'unexpected'};
void CommentPostTarget.select([unknownEntry], ['threads']);
// @ts-expect-error thread collection must be an array
void CommentPostTarget.select({id: 1}, []);
// @ts-expect-error issue collection must be an array
void CommentPostTarget.select(entries, null);
