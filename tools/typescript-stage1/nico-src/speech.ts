/**
 * Canonical TypeScript source for packages/lib/src/infra/speech.js (Task726).
 * Web Speech API text-to-speech; a new utterance cancels one already speaking,
 * otherwise it waits for the previous one to finish.
 */
export type SpeechOption = Partial<Pick<SpeechSynthesisUtterance, 'lang' | 'pitch' | 'rate' | 'voice' | 'volume'>>;
type Props = Record<string, unknown>;

class speech {
  /** Settles when the latest utterance ends (set after the class body). */
  declare static promise: Promise<unknown>;
  declare static _voices: SpeechSynthesisVoice[] | undefined;

  static async speak(text: string, option: SpeechOption = {}): Promise<unknown> {
    if (!window.speechSynthesis) {
      return Promise.resolve();
    }
    const msg = new window.SpeechSynthesisUtterance();

    ['lang', 'pitch', 'rate', 'voice', 'volume'].forEach(prop => {
      option.hasOwnProperty(prop) && ((msg as unknown as Props)[prop] = (option as Props)[prop]);
    });

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    } else {
      await this.promise;
    }

    return this.promise = new Promise(res => {
      msg.addEventListener('end', res, {once: true});
      msg.addEventListener('error', res, {once: true});
      msg.text = text;
      window.speechSynthesis.speak(msg);
    });
  }
  static voices(lang?: string): SpeechSynthesisVoice[] {
    if (!window.speechSynthesis) {
      return [];
    }
    this._voices = this._voices || window.speechSynthesis.getVoices();
    return lang ? this._voices.filter(v => v.lang === lang) : this._voices;
  }
}
speech.promise = Promise.resolve();

export {speech};
