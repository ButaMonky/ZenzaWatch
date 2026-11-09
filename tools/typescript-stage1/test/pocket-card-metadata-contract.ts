// Task190: TS contracts for untrusted card metadata and fetch boundaries.
import type {PocketCardMetadata, PocketCardOwner, PocketCardThumbnail, PocketFetcher} from
  '../../../packages/zenza/src/pocket/PocketCardMetadataLoader';

declare const metadata: PocketCardMetadata;
const validLike: number | null = metadata.likeCount;
const ownerKind: 'user' | 'channel' | undefined = metadata.owner?.type;
const maybeImage: string | undefined = metadata.thumbnail?.ogp;
void validLike; void ownerKind; void maybeImage;

// @ts-expect-error like count is never a string
const badLike: number = '12';
// @ts-expect-error only user and channel owner kinds are allowed
const badOwnerKind: NonNullable<PocketCardMetadata['owner']>['type'] = 'organization';
// @ts-expect-error the result must expose an async JSON parser
const invalidFetcher: PocketFetcher = async () => ({ok: true});
void invalidFetcher;

// Additional invalid API/owner/thumbnail cases consolidated from #202.
// @ts-expect-error a raw, unchecked API body is not validated metadata
const untrustedRecord: PocketCardMetadata = {} as unknown;
void untrustedRecord;
// @ts-expect-error likeCount cannot be a string after parsing
const invalidRecord: PocketCardMetadata = {videoId: 'sm9', likeCount: '5', owner: null, thumbnail: null};
void invalidRecord;
// @ts-expect-error owner kind must be user or channel
const invalidOwnerKind: PocketCardOwner['type'] = 'robot';
void invalidOwnerKind;
// @ts-expect-error unrecognized thumbnail keys are not allowed
const invalidThumbnail: PocketCardThumbnail = {arbitrary: 'https://example.invalid'};
void invalidThumbnail;
