import type {ZenzaCommentSortKey, ZenzaCommentReadingModelPort, ZenzaCommentReadIdentity} from '../nico-src/CommentReadTypes';
import type {CommentInputPanel} from '../nico-src/CommentInputPanel';
declare const submission: ReturnType<CommentInputPanel['submit']>;
// @ts-expect-error production submission result cannot be arbitrary text
const badSubmission: typeof submission = 'posted';
/** Compile-only negative checks for comment list update owners (Task188). */
declare const readModel: ZenzaCommentReadingModelPort;
declare const identity: ZenzaCommentReadIdentity;
const time: number = readModel._currentTime;
const generation: number = readModel._readingEpoch;
const positions: number[] = readModel._positions;
void time; void generation; void positions;
const sortByTime: ZenzaCommentSortKey = 'vpos';
void sortByTime;
// @ts-expect-error a snapshot's generation is not a string
const invalidEpoch: ZenzaCommentReadIdentity = {epoch: '1', model: readModel, revision: 1};
// @ts-expect-error a valid sort value cannot be arbitrary text
const invalidSort: ZenzaCommentSortKey = 'priority';
// @ts-expect-error the read model needs a numeric generation
const invalidModel: ZenzaCommentReadingModelPort = {_readingEpoch: 'old', _positions: [], _currentTime: 0};
// @ts-expect-error a frozen snapshot's epoch may not be overwritten
identity.epoch = 3;
