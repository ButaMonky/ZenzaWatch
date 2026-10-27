import {NicoTextParser, NicoTextParserInitFunc} from '../comment-src/NicoTextParser';
import type {
  NicoTextParserRuntimeContract,
  NicoTextParserFontRegexContract
} from '../comment-src/NicoTextParser';

const parser: NicoTextParserRuntimeContract=NicoTextParser;
const fresh: NicoTextParserRuntimeContract=NicoTextParserInitFunc();
const css: string=parser.__css__;
const html5: string=parser.likeHTML5('hello');
const xp: string=fresh.likeXP('hello');
const regex: RegExp=parser._FONT_REG.GOTHIC;
const rules: NicoTextParserFontRegexContract=parser._FONT_REG;
void css;void html5;void xp;void regex;void rules;
// @ts-expect-error Public renderer only accepts strings.
parser.likeXP(123);
// @ts-expect-error The CSS stylesheet must remain a string.
const invalidCss: number=parser.__css__;
void invalidCss;
