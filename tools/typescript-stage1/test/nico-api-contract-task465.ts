// Task465: compile-only RSS item and ranking signature contract.
import {NicoRssLoader} from '../nico-src/NicoRssLoader';
import type {NicoRssItem,NicoRssLoaderClient,NicoRssRankingOptions} from '../nico-src/NicoRssLoader';

const client: NicoRssLoaderClient=NicoRssLoader;
const opts: NicoRssRankingOptions={genre:'all',term:'24h',tag:'音楽'};
const items: Promise<NicoRssItem[]>=client.loadRanking(opts);
void items;
void client.load('https://example.invalid/rss');
void client.loadRanking({});
void client.loadRanking({term:'week'});
// @ts-expect-error only known ranking terms are allowed
void client.loadRanking({term:'invalid'});
// @ts-expect-error genre must be a string
void client.loadRanking({genre:1});
// @ts-expect-error ranking options are required (legacy throws for omitted object)
void client.loadRanking();
async function parse() {
  const first=(await client.load('https://example.invalid/rss'))[0]!;
  const id: string=first.id;
  const title: string|null=first.title;
  void id;void title;
  // @ts-expect-error optional counters need a presence check
  first.num_res.toFixed();
  // @ts-expect-error unsupported item attribute
  return first.nonexistent;
}
void parse;
