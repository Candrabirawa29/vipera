/**
 * Audio cues, Speech Synthesis, and Vibration feedback for running & interval workouts.
 */

export interface AudioSettings {
  voiceEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Play a clean short beep tone (frequency in Hz, duration in seconds).
   */
  public beep(frequency = 880, duration = 0.15, type: OscillatorType = "sine") {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Play double high chime for step transition.
   */
  public chimeTransition() {
    this.beep(660, 0.1);
    setTimeout(() => {
      this.beep(990, 0.2);
    }, 120);
  }

  /**
   * Countdown tick beep (lower pitch).
   */
  public countdownTick() {
    this.beep(440, 0.08);
  }

  /**
   * Completion celebratory chime.
   */
  public completionChime() {
    this.beep(523.25, 0.12); // C5
    setTimeout(() => this.beep(659.25, 0.12), 120); // E5
    setTimeout(() => this.beep(783.99, 0.25), 240); // G5
  }
}

export const soundSynth = new SoundSynthesizer();

/**
 * Spoken voice cue using Browser Web Speech API.
 */
export function speakCue(text: string, enabled = true) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // cancel pending utterances
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful fallback
  }
}

/**
 * Trigger vibration pattern if supported on mobile.
 */
export function vibrateDevice(pattern: number | number[], enabled = true) {
  if (!enabled || typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration not supported or permission denied
  }
}

/**
 * Combined cue for countdown (3, 2, 1).
 */
export function cueCountdown(second: number, settings: AudioSettings) {
  if (settings.soundEnabled) {
    soundSynth.countdownTick();
  }
  if (settings.vibrationEnabled) {
    vibrateDevice(80, true);
  }
  if (settings.voiceEnabled) {
    speakCue(second.toString(), true);
  }
}

/**
 * Combined cue for step transition (e.g. "Run 400 meters").
 */
export function cueStepTransition(
  spokenDescription: string,
  settings: AudioSettings
) {
  if (settings.soundEnabled) {
    soundSynth.chimeTransition();
  }
  if (settings.vibrationEnabled) {
    vibrateDevice([200, 100, 250], true);
  }
  if (settings.voiceEnabled) {
    // Slight delay to allow transition chime to ring first
    setTimeout(() => {
      speakCue(spokenDescription, true);
    }, 250);
  }
}

/**
 * Combined cue for workout completion.
 */
export function cueWorkoutComplete(settings: AudioSettings) {
  if (settings.soundEnabled) {
    soundSynth.completionChime();
  }
  if (settings.vibrationEnabled) {
    vibrateDevice([150, 80, 150, 80, 300], true);
  }
  if (settings.voiceEnabled) {
    setTimeout(() => {
      speakCue("Workout complete. Excellent effort!", true);
    }, 350);
  }
}
