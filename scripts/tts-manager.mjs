/**
 * Speech Manager
 * Speech-to-text (dictation) via Web Speech Recognition API (browser-native).
 * Also provides text-to-speech for voice preview in the Edit Speaker dialog.
 */

export class TTSManager {
  constructor() {
    // --- Speech Recognition (speech-to-text) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this._listening = false;
    this._onResult = null;
    this._onEnd = null;

    if (this._recognition) {
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      this._recognition.lang = navigator.language || 'en-US';

      this._recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        this._onResult?.(final, interim);
      };

      this._recognition.onend = () => {
        this._listening = false;
        this._onEnd?.();
      };

      this._recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          console.warn('StoryFrame | Speech recognition error:', event.error);
        }
        this._listening = false;
        this._onEnd?.();
      };
    }

    // --- Text-to-Speech (for voice preview only) ---
    this._synth = window.speechSynthesis ?? null;
    /** @type {Map<string, {voice: SpeechSynthesisVoice, pitch: number, rate: number}>} */
    this._voiceMap = new Map();
  }

  // --- Speech-to-Text ---

  /** Whether the browser supports speech recognition */
  get isSupported() {
    return !!this._recognition;
  }

  /** Whether currently listening */
  get isListening() {
    return this._listening;
  }

  /**
   * Start listening for speech and transcribing to text.
   * @param {Object} callbacks
   * @param {Function} callbacks.onResult - (finalText, interimText) => void
   * @param {Function} [callbacks.onEnd] - () => void (called when recognition stops)
   */
  startListening({ onResult, onEnd } = {}) {
    if (!this._recognition || this._listening) return;
    this._onResult = onResult;
    this._onEnd = onEnd;
    this._listening = true;
    try {
      this._recognition.start();
    } catch {
      // Already started
      this._listening = false;
    }
  }

  /** Stop listening */
  stopListening() {
    if (!this._recognition) return;
    this._listening = false;
    try {
      this._recognition.stop();
    } catch {
      // Already stopped
    }
  }

  /**
   * Set the recognition language.
   * @param {string} lang - BCP 47 language tag (e.g. 'en-US', 'ja-JP')
   */
  setLanguage(lang) {
    if (this._recognition) {
      this._recognition.lang = lang;
    }
  }

  // --- Text-to-Speech (voice preview) ---

  /**
   * Get available system voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  getVoices() {
    return this._synth?.getVoices() ?? [];
  }

  /**
   * Assign a voice configuration to a speaker (for preview/future TTS use).
   * @param {string} speakerId
   * @param {Object} config
   * @param {string} config.voiceName
   * @param {number} [config.pitch=1.0]
   * @param {number} [config.rate=1.0]
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
   * Speak text (used for voice preview in Edit Speaker dialog).
   * @param {string} speakerId
   * @param {string} text
   */
  speak(speakerId, text) {
    if (!this._synth || !text) return;
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

  /** Stop any ongoing speech. */
  stop() {
    this.stopListening();
    this._synth?.cancel();
  }
}
