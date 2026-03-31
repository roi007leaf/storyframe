/**
 * TTS Manager
 * Per-speaker text-to-speech using the Web Speech Synthesis API (browser-native).
 * Allows assigning distinct voices, pitch, and rate to each speaker.
 */

export class TTSManager {
  constructor() {
    /** @type {Map<string, {voice: SpeechSynthesisVoice, pitch: number, rate: number}>} */
    this._voiceMap = new Map();
    this.enabled = false;
    this._synth = window.speechSynthesis ?? null;
    this._voicesReady = false;

    // Voices load asynchronously in most browsers
    if (this._synth) {
      this._synth.addEventListener?.('voiceschanged', () => {
        this._voicesReady = true;
      });
      // Some browsers populate immediately
      if (this._synth.getVoices().length > 0) this._voicesReady = true;
    }
  }

  /** Whether the browser supports speech synthesis */
  get isSupported() {
    return !!this._synth;
  }

  /**
   * Get available system voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  getVoices() {
    return this._synth?.getVoices() ?? [];
  }

  /**
   * Get voices grouped by language for UI display.
   * @returns {Map<string, SpeechSynthesisVoice[]>}
   */
  getVoicesByLanguage() {
    const map = new Map();
    for (const voice of this.getVoices()) {
      const lang = voice.lang.split('-')[0];
      if (!map.has(lang)) map.set(lang, []);
      map.get(lang).push(voice);
    }
    return map;
  }

  /**
   * Assign a voice configuration to a speaker.
   * @param {string} speakerId
   * @param {Object} config
   * @param {string} config.voiceName - SpeechSynthesisVoice.name to match
   * @param {number} [config.pitch=1.0] - 0 to 2
   * @param {number} [config.rate=1.0] - 0.1 to 10
   */
  setVoice(speakerId, { voiceName, pitch = 1.0, rate = 1.0 }) {
    const voice = this.getVoices().find(v => v.name === voiceName);
    if (voice) {
      this._voiceMap.set(speakerId, { voice, pitch, rate });
    }
  }

  /**
   * Remove voice assignment for a speaker.
   * @param {string} speakerId
   */
  removeVoice(speakerId) {
    this._voiceMap.delete(speakerId);
  }

  /**
   * Speak text as a specific speaker.
   * @param {string} speakerId
   * @param {string} text
   */
  speak(speakerId, text) {
    if (!this.enabled || !this._synth || !text) return;

    // Cancel any ongoing speech
    this._synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const config = this._voiceMap.get(speakerId);

    if (config) {
      utterance.voice = config.voice;
      utterance.pitch = config.pitch;
      utterance.rate = config.rate;
    }

    this._synth.speak(utterance);
  }

  /** Stop any ongoing speech immediately. */
  stop() {
    this._synth?.cancel();
  }

  /** Check if speech is in progress. */
  get isSpeaking() {
    return this._synth?.speaking ?? false;
  }

  /**
   * Serialize voice assignments for persistence.
   * @returns {Object} Map of speakerId → { voiceName, pitch, rate }
   */
  serialize() {
    const data = {};
    for (const [id, config] of this._voiceMap) {
      data[id] = {
        voiceName: config.voice.name,
        pitch: config.pitch,
        rate: config.rate,
      };
    }
    return data;
  }

  /**
   * Restore voice assignments from serialized data.
   * @param {Object} data - Output of serialize()
   */
  restore(data) {
    if (!data) return;
    for (const [id, config] of Object.entries(data)) {
      this.setVoice(id, config);
    }
  }
}
