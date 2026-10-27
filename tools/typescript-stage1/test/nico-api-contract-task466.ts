// Task466: strict compile-only checks for Nicodic article lookup.
import {NicodicArticleLoader} from '../nico-src/NicodicArticleLoader';
import type {NicodicArticle} from '../nico-src/NicodicArticleLoader';

const response: Promise<boolean | null> = NicodicArticleLoader.exists('VOCALOID');
void response;
void NicodicArticleLoader.exists(undefined);
// @ts-expect-error article presence may be unknown after a failed request
const alwaysBoolean: Promise<boolean> = NicodicArticleLoader.exists('x');
void alwaysBoolean;
// @ts-expect-error invalid lookup input is rejected at compile time
void NicodicArticleLoader.exists(1);

void NicodicArticleLoader.checkAll(['VOCALOID', null, 10, '東方'], (name, exists, article) => {
  const title: string = article?.title ?? '';
  const present: boolean = exists;
  const key: string = name;
  void title; void present; void key;
  if (article) {
    const unknownExtension: unknown = article.summary;
    void unknownExtension;
    // @ts-expect-error unverified response fields cannot be assumed strings
    const notAString: string = article.summary;
    void notAString;
  }
});
const article: NicodicArticle = {request_title: 'x', title: 'X'};
void article;
