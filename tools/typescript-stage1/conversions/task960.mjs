// Task960 conversion config for scripts/legacy-to-ts.mjs (CustomElements, ShortcutKeyEmitter,
// YouTubeWrapper). Kept so the conversion can be re-run or audited.
const EMITTER = `declare class Emitter {
  constructor(...args: Loose[]);
  on(name: string, callback: (...args: Loose[]) => unknown): this;
  emit(name: string, ...args: unknown[]): unknown;
  emitAsync(name: string, ...args: unknown[]): unknown;
  promise(name: string): Promise<unknown>;
}
`;
const DEBOUNCE = `/** The lodash function used here. */
declare const _: {debounce<T extends (...args: Loose[]) => unknown>(fn: T, wait?: number): T & {cancel(): void}};
`;

export default {
  task: 'task960',
  title: 'custom elements, shortcut keys and YouTube wrapper',
  modules: {
    CustomElements: {
      runtime: 'packages/zenza/src/parts/CustomElements.js',
      cls: ['PlaylistAppend', 'SeekbarLabel'],
      fieldTypes: {
        PlaylistAppend: {_shadow: 'ShadowRoot'},
        SeekbarLabel: {_shadow: 'ShadowRoot', props: '{time: number; duration: number; text: string | null}'}
      },
      types: DEBOUNCE,
      rep: [
        ['const CustomElements = {};', 'const CustomElements: {initialize?: () => void} = {};', 1],
        ['      shadow.innerHTML = this.constructor.template();',
          '      shadow.innerHTML = (this.constructor as unknown as {template(): string}).template();', 2],
        ["      this.setAttribute('data-param', this.props.time);",
          "      this.setAttribute('data-param', this.props.time as unknown as string);", 1],
        ["    disconnectedCallback() {\n      this._shadow.textContent = '';\n    }",
          "    // Task960 (CUSTOMELEMENTS-RECONNECT-001): disconnectedCallback empties the shadow root,\n" +
          "    // so a button moved elsewhere in the DOM came back empty. Rebuild it on reconnect.\n" +
          "    connectedCallback() {\n" +
          "      if (!this._shadow.firstChild) {\n" +
          "        this._shadow.innerHTML = (this.constructor as unknown as {template(): string}).template();\n" +
          "      }\n" +
          "    }\n\n" +
          "    disconnectedCallback() {\n      this._shadow.textContent = '';\n    }", 1],
      ],
      exp: 'export {\n  CustomElements\n};',
      exportNames: ['CustomElements'],
    },
    ShortcutKeyEmitter: {
      runtime: 'packages/zenza/src/ShortcutKeyEmitter.js',
      cls: 'ShortcutKeyEmitter',
      types: EMITTER + `/** The shortcut registry (packages/zenza/src/ShortcutActions.js). */
declare const SHORTCUT_ACTIONS: Loose[];
`,
      rep: [
        ['    let isVerySlow = false;\n',
          '    let isVerySlow = false;\n' +
          '    // Task960 (SHORTCUT-UNSET-ZERO-001): 0 means "not set" (as for the newer shortcuts), but a\n' +
          '    // legacy key stored as 0 matched every keydown whose keyCode is 0 (some special keys and\n' +
          '    // synthetic events), so e.g. an unset CLOSE closed the player. Unset keys never match now.\n' +
          '    const legacyKey = (value: unknown) => parseInt(value as string, 10) || -1;\n', 1],
        ['    const map = {', '    const map: Record<string, number> = {', 1],
        ['      map[key] = parseInt(config.props[`KEY_${key}`], 10);', '      map[key] = legacyKey(config.props[`KEY_${key}`]);', 1],
        ['          map[k] = parseInt(config.props[`KEY_${k}`], 10);', '          map[k] = legacyKey(config.props[`KEY_${k}`]);', 1],
        ['    let dynamicMap = {};', '    let dynamicMap: Record<number, Loose> = {};', 1],
        ['      const next = {};', '      const next: Record<number, Loose> = {};', 1],
        ["      config.on('update', key => {", "      config.on('update', (key: Loose) => {", 1],
        ['    const isInputEvent = e => {', '    const isInputEvent = (e: Loose) => {', 1],
        ['      return nodes.some(node => {', '      return nodes.some((node: Loose) => {', 1],
        ['    const onKeyDown = e => {', '    const onKeyDown = (e: Loose) => {', 1],
        ['    const onKeyUp = e => {', '    const onKeyUp = (e: Loose) => {', 1],
        ["      let param = '';", "      let param: Loose = '';", 2],
      ],
      exp: 'export {ShortcutKeyEmitter};',
    },
    YouTubeWrapper: {
      runtime: 'packages/zenza/src/videoPlayer/YouTubeWrapper.js',
      cls: 'YouTubeWrapper',
      types: EMITTER + DEBOUNCE + `declare const global: {debug: Loose};
declare const textUtil: {parseUrl(url: Loose): Loose; parseQuery(query: string): Loose};
declare const window: Window & typeof globalThis & {YT?: Loose; onYouTubeIframeAPIReady?: Loose};
`,
      rep: [
        ['  class YouTubeWrapper extends Emitter {\n',
          '  class YouTubeWrapper extends Emitter {\n    declare static _ytApiPromise: Promise<Loose> | null;\n', 1],
        ['    constructor({parentNode, autoplay = true, volume = 0.3, playbackRate = 1, loop = false}) {',
          '    constructor({parentNode, autoplay = true, volume = 0.3, playbackRate = 1, loop = false}:\n' +
          '      {parentNode: Loose; autoplay?: boolean; volume?: number; playbackRate?: number; loop?: boolean}) {', 1],
        ['    async setSrc(url, startSeconds = 0) {', '    async setSrc(url?: Loose, startSeconds: Loose = 0): Promise<Loose> {', 1],
        ['        const {player} = await new Promise(resolve => {', '        const {player} = await new Promise<Loose>(resolve => {', 1],
        ["                onPlaybackQualityChange: e => window.console.info('video quality: ', e.data),",
          "                onPlaybackQualityChange: (e: Loose) => window.console.info('video quality: ', e.data),", 1],
        ["                onError: e => this.emit('error', e)", "                onError: (e: Loose) => this.emit('error', e)", 1],
        ['        const onError = error => {', '        const onError = (error?: Loose) => {', 1],
        ['      return this[k];', '      return (this as Loose)[k];', 1],
        ['      const timeDiff = (now - this._lastTime) * this.playbackRate / 1000000;\n' +
          '      this._lastCurrentTime = Math.min(currentTime, this.duration);\n' +
          '      return currentTime + timeDiff;',
          '      // Task960 (YOUTUBE-CURRENTTIME-UNIT-001): performance.now() is in milliseconds; the old\n' +
          '      // `/ 1000000` made this interpolation 1000 times too small, so it never smoothed anything.\n' +
          '      const timeDiff = (now - this._lastTime) * this.playbackRate / 1000;\n' +
          '      this._lastCurrentTime = Math.min(currentTime, this.duration);\n' +
          '      return Math.min(currentTime + timeDiff, this.duration);', 1],
      ],
      exp: 'export {\n  YouTubeWrapper\n};',
    },
  },
  allowlist: [
    ['videoPlayer\\/createVideoElement|', 'videoPlayer\\/(?:createVideoElement|YouTubeWrapper)|'],
    ['parts\\/(?:saveMymemory|FrameLayer|BaseViewComponent)|', 'parts\\/(?:saveMymemory|FrameLayer|BaseViewComponent|CustomElements)|ShortcutKeyEmitter|'],
  ],
};
