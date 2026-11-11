/** Type-only ownership boundary for in-memory comment list reads (Task188).
 * The comment records themselves remain untrusted legacy objects.
 */
export type ZenzaCommentSortKey = 'vpos' | 'date' | 'text' | 'user' | 'nicoru';
export interface ZenzaCommentReadingModelPort {
  readonly _readingEpoch: number;
  readonly _positions: number[];
  readonly _currentTime: number;
}
export type ZenzaCommentReadIdentity = Readonly<{
  epoch: number;
  model: ZenzaCommentReadingModelPort;
  revision: number;
}>;
