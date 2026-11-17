// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: comment-src/NicoTextParser.ts
/**

 参考: http://www37.atwiki.jp/commentart/pages/44.html
 https://www.w3.org/TR/css3-fonts/#font-kerning-prop

 MINCHO

 \u02C9\u2105\u2109\u2196-\u2199\u220F\u2215\u2248\u2264\u2265\u2299\u2474-\u2482\u250D\u250E\u2511\u2512\u2515\u2516\u2519\u251A\u251E\u251F\u2521\u2522\u2526\u2527\u2529\u252A\u252D\u252E\u2531\u2532\u2535\u2536\u2539\u253A\u253D\u253E\u2540\u2541\u2543-\u254A\u2550-\u256C\u2584\u2588\u258C\u2593

 GULIM
 \u0126\u0127\u0132\u0133\u0138\u013F\u0140\u0149-\u014B\u0166\u0167\u02D0\u02DA\u2074\u207F\u2081-\u2084\u2113\u2153\u2154\u215C-\u215E\u2194-\u2195\u223C\u249C-\u24B5\u24D0-\u24E9\u2592\u25A3-\u25A9\u25B6\u25B7\u25C0\u25C1\u25C8\u25D0\u25D1\u260E\u260F\u261C\u261E\u2660\u2661\u2663-\u2665\u2667-\u2669\u266C\u3131-\u318E\u3200-\u321C\u3260-\u327B\u3380-\u3384\u3388-\u338D\u3390-\u339B\u339F\u33A0\u33A2-\u33CA\u33CF\u33D0\u33D3\u33D6\u33D8\u33DB-\u33DD\uF900-\uF928\uF92A-\uF994\uF996-\uFA0B\uFFE6

 STRONG MINCHO
 \u01CE\u0D00\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u0251\u0261\u02CA\u02CB\u2016\u2035\u216A\u216B\u2223\u2236\u2237\u224C\u226E\u226F\u2295\u2483-\u249B\u2504-\u250B\u256D-\u2573\u2581-\u2583\u2585-\u2586\u2589-\u258B\u258D-\u258F\u2594\u2595\u25E2-\u25E5\u2609\u3016\u3017\u301E\u3021-\u3029\u3105-\u3129\u3220-\u3229\u32A3\u33CE\u33D1\u33D2\u33D5\uE758-\uE864\uFA0C\uFA0D\uFE30\uFE31\uFE33-\uFE44\uFE49-\uFE52\uFE54-\uFE57\uFE59-\uFE66\uFE68-\uFE6B\uFA0C\uFA0D\uFE30\uFE31\uFE33-\uFE44\uFE49-\uFE52\uFE54-\uFE57\uFE59-\uFE66\uFE68-\uFE6B


 MINCHO: /([ˊˋ⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑⒒⒓⒔⒕⒖⒗⒘⒙⒚⒛▁▂▃▄▅▆▇█▉▊▋▌▍▎▏◢◣◤◥〡〢〣〤〥〦〧〨〩ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ︰︱︳︴︵︶︷︸︹︺︻︼︽︾︿﹀﹁﹂﹃﹄﹉﹊﹋﹌﹍﹎﹏﹐﹑﹒﹔﹕﹖﹗﹙﹚﹛﹜﹝﹞﹟﹠﹡﹢﹣﹤﹥﹦﹨﹩﹪﹫▓])/g,
 MINCHO: /([\u02CA-\u02CB\u2474-\u2487\u2488-\u249B\u2581-\u258F\u25E2-\u25E5\u2593-\u2595\u3021-\u3029\u3105-\u3129\uFE30-\uFE31\uFE33-\uFE44\uFE49-\uFE52\uFE54-\uFE57\uFE59-\uFE66\uFE68-\uFE6B])/g,
 GULIM: /([㈀㈁㈂㈃㈄㈅㈆㈇㈈㈉㈊㈋㈌㈍㈎㈏㈐㈑㈒㈓㈔㈕㈖㈗㈘㈙㈚㈛㈜㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻㉿ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵￦⊙ㅂㅑㅜㆁ▒ㅅㅒㅡㆍㄱㅇㅓㅣㆎㄴㅏㅕㅤ♡ㅁㅐㅗㅿ♥])/g,
 GULIM: /([\u2299\u2592\u3131\u3134\u3141\u3142\u3145\u3147\u314F\u3150\u3151\u3152\u3153\u3155\u3157\u315C\u3161\u3163\u3164\u317F\u3181\u318D\u318E\u2661\u2688\u2665\u3200-\u321C\u3260-\u327B\u24D0-\u24E9\u249C-\u24B5\uFFE6])/g,
 MING_LIU: /([])/g,

 */
export interface NicoTextParserContract {
    readonly originalText: string;
    readonly normalizedText: string;
    readonly lines: readonly string[];
}
export interface NicoTextParserFontRegexContract {
    GOTHIC: RegExp;
    MINCHO: RegExp;
    GULIM: RegExp;
    MING_LIU: RegExp;
    GR: RegExp;
    STRONG_MINCHO: RegExp;
    BLOCK: RegExp;
}
export interface NicoTextParserRuntimeContract {
    readonly _FONT_REG: NicoTextParserFontRegexContract;
    readonly __css__: string;
    likeXP(text: string): string;
    likeHTML5(text: string): string;
}
declare function NicoTextParserInitFunc(): NicoTextParserRuntimeContract;
declare const NicoTextParser: NicoTextParserRuntimeContract;
export { NicoTextParser, NicoTextParserInitFunc };
