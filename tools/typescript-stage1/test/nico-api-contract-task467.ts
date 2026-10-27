// Task467: strict, compile-time public surface checks.
import {
  OwnerSupplement,
  type OwnerSupplementClient,
  type SupplementedOwner,
  type SupplementableThumbInfo
} from '../nico-src/OwnerSupplement';

const client: OwnerSupplementClient = OwnerSupplement;
const loaded: Promise<SupplementedOwner | null> = client.loadFromNicoad('sm9');
const input: SupplementableThumbInfo | null = {status: 'ok', videoId: 'sm9', owner: null};
const sameObject: Promise<SupplementableThumbInfo | null> =
  client.supplementThumbInfo(input);
void [loaded, sameObject];
