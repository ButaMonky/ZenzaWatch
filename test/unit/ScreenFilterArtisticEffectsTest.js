import assert from 'assert';
import {ScreenFilter} from '../../packages/zenza/src/videoPlayer/ScreenFilter';

const values = patch => Object.assign({}, ScreenFilter.DEFAULTS, patch);
const build = patch => ScreenFilter.buildSvgFilterMarkup(values(patch));
describe('ScreenFilter artistic effects', function() {
  beforeEach(() => ScreenFilter._reset());
  afterEach(() => ScreenFilter._reset());

  it('keeps the zero-effect fast path, including inactive auxiliary controls', () => {
    assert.equal(build({}), '');
    assert.equal(build({bloomRadius: 12, bloomThreshold: 95, edgeStyle: 'emboss', grainSize: 4, scanlineSpacing: 8}), '');
    assert.equal(ScreenFilter.buildFilter(values({}), {enabled: true}), 'none');
  });

  it('chains bloom after sharpen instead of discarding the sharpened result', () => {
    const markup = build({sharpen: 25, bloom: 50});
    assert(markup.includes('result="sfSharpen"'));
    assert(markup.includes('<feComponentTransfer in="sfSharpen" result="sfBloomBright">'));
    assert(markup.includes('in="sfSharpen" in2="sfBloomBlur"'));
    assert(!/NaN|Infinity|undefined/.test(markup));
  });

  it('uses discrete posterization with an exact bounded number of levels', () => {
    assert(build({posterize: 4}).includes('type="discrete" tableValues="0 0.3333 0.6667 1"'));
    assert(build({posterize: 1}).includes('tableValues="0 1"'));
    assert.equal((build({posterize: 4}).match(/type="discrete"/g) || []).length, 3);
    assert.equal(ScreenFilter.normalize('posterize', 10000), 16);
  });

  it('supports sketch, colored edges and emboss with preserved alpha', () => {
    const sketch = build({edge: 100});
    assert(sketch.includes('sfEdgeMono'));
    assert(sketch.includes('bias="1"'));
    assert(sketch.includes('preserveAlpha="true"'));
    assert(sketch.includes('k2="0" k3="1"'));
    const neon = build({edge: 50, edgeStyle: 'neon'});
    assert(!neon.includes('sfEdgeMono'));
    assert(neon.includes('k2="0.5" k3="0.5"'));
    assert(build({edge: 100, edgeStyle: 'emboss'}).includes('bias="0.5"'));
  });

  it('offsets red and blue in opposite directions and adds all three channels', () => {
    const markup = build({rgbShift: -3});
    assert(markup.includes('in="sfRgbR" dx="-3"'));
    assert(markup.includes('in="sfRgbB" dx="3"'));
    assert(markup.includes('in="sfRgbOffsetR" in2="sfRgbG"'));
    assert(markup.includes('in="sfRgbRG" in2="sfRgbOffsetB"'));
    assert.equal(ScreenFilter.normalize('rgbShift', 999), 12);
  });

  it('keeps noise fixed and bounded to a small tile without image resources', () => {
    const markup = build({grain: 40});
    assert.equal(markup, build({grain: 40}));
    assert(markup.includes('numOctaves="1" seed="17" stitchTiles="stitch"'));
    assert(markup.includes('width="64" height="64" result="sfGrainNoise"'));
    assert(markup.includes('<feTile in="sfGrainTile"'));
    assert(markup.includes('mode="soft-light"'));
    assert(!/feImage|href=|data:|https?:/.test(markup));
  });

  it('tiles a one-pixel scanline with an explicit transparent gap', () => {
    const markup = build({scanlines: 100, scanlineSpacing: 5});
    assert(markup.includes('height="1" result="sfScanStripe"'));
    assert(markup.includes('height="5" result="sfScanTile"'));
    assert(markup.includes('<feTile in="sfScanTile"'));
    assert(markup.endsWith('operator="over" result="sfScanlines"/>'));
  });

  it('keeps all artistic results ordered and referenced when combined', () => {
    const markup = build({bloom: 40, posterize: 4, edge: 30, rgbShift: 2, grain: 20, scanlines: 25});
    const results = ['sfBloom', 'sfPosterize', 'sfEdge', 'sfRgb', 'sfGrain', 'sfScanlines'];
    let cursor = -1;
    for (const result of results) {
      const next = markup.indexOf(`result="${result}"`);
      assert(next > cursor, result); cursor = next;
    }
    const known = new Set(['SourceGraphic', 'SourceAlpha']);
    for (const tag of markup.match(/<fe[^>]+>/g)) {
      for (const match of tag.matchAll(/\bin2?="([^"]+)"/g)) assert(known.has(match[1]), match[1]);
      const result = tag.match(/\bresult="([^"]+)"/);
      if (result) known.add(result[1]);
    }
  });

  it('clips generated textures to the video rectangle for offset PiP and screenshots',()=>{
    ScreenFilter.initialize({props:{},on(){}});ScreenFilter.applyPreset('grainFilm');
    const calls=[];const ctx=new Proxy({}, {get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
    ScreenFilter.drawVideo(ctx,{},40,20,640,360,{target:'commentPip'});
    assert.deepEqual(calls.slice(0,4),[['save'],['beginPath'],['rect',40,20,640,360],['clip']]);
    assert(calls.findIndex(c=>c[0]==='clip')<calls.findIndex(c=>c[0]==='drawImage'));
  });

  it('provides normalized presets and propagates effects through the shared filter path', () => {
    const config = {props: {}, on() {}, onkey() {}};
    ScreenFilter.initialize(config);
    for (const id of ['softGlow', 'popPoster', 'pencilSketch', 'neonEdges', 'emboss', 'chromatic', 'grainFilm', 'retroCrt']) {
      const preset = ScreenFilter.PRESETS.find(p => p.id === id);
      assert(preset, id);
      for (const [key, value] of Object.entries(preset.values)) assert.equal(ScreenFilter.normalize(key, value), value);
      ScreenFilter.applyPreset(id);
      assert.equal(ScreenFilter.buildFilter(), 'url(#zenzaScreenFilterSvg)');
      assert.equal(ScreenFilter.detectPreset(), id);
    }
    ScreenFilter.reset();
    assert.equal(ScreenFilter.buildFilter(), 'none');
  });
});
