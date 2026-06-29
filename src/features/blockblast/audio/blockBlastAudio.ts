type ToneOptions = {
  waveform?: OscillatorType;
  volume?: number;
  attack?: number;
  release?: number;
};

class BlockBlastAudio {
  private context: AudioContext | null = null;
  private musicEnabled = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private unlockListenersBound = false;

  private readonly unlock = () => {
    void this.resumeContext().then((context) => {
      if (!context || context.state !== "running") return;
      this.removeUnlockListeners();
      if (this.musicEnabled) this.startMusicLoop();
    });
  };

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;

    if (!enabled) {
      this.stopMusicLoop();
      this.removeUnlockListeners();
      return;
    }

    const context = this.ensureContext();
    if (!context) return;

    if (context.state === "running") {
      this.startMusicLoop();
    } else {
      this.addUnlockListeners();
    }
  }

  playPlace() {
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 329.63, now, 0.08, { waveform: "triangle", volume: 0.05 });
      this.tone(context, 493.88, now + 0.045, 0.09, { waveform: "sine", volume: 0.035 });
    });
  }

  playInvalid() {
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 132, now, 0.11, { waveform: "sawtooth", volume: 0.025, release: 0.05 });
      this.tone(context, 118, now + 0.035, 0.1, { waveform: "sawtooth", volume: 0.018, release: 0.05 });
    });
  }

  playLineClear(clearedRows: number, clearedCols: number, combo: number) {
    this.withRunningContext((context) => {
      const lineCount = clearedRows + clearedCols;
      const now = context.currentTime + 0.01;
      const base = clearedRows > 0 && clearedCols > 0 ? 392 : clearedRows > 0 ? 349.23 : 329.63;

      for (let i = 0; i < Math.max(1, lineCount); i += 1) {
        this.tone(context, base * (1 + i * 0.16), now + i * 0.055, 0.16, {
          waveform: "triangle",
          volume: 0.055,
          release: 0.12,
        });
      }

      if (combo > 1) {
        this.tone(context, 659.25 + combo * 18, now + 0.13, 0.18, {
          waveform: "sine",
          volume: 0.04,
          release: 0.14,
        });
      }
    });
  }

  playCombo(combo: number) {
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const count = Math.min(notes.length, Math.max(2, combo));

      for (let i = 0; i < count; i += 1) {
        this.tone(context, notes[i] + combo * 8, now + i * 0.05, 0.16, {
          waveform: "sine",
          volume: 0.035,
          release: 0.12,
        });
      }
    });
  }

  playGameOver() {
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      [392, 329.63, 261.63].forEach((frequency, index) => {
        this.tone(context, frequency, now + index * 0.1, 0.18, {
          waveform: "triangle",
          volume: 0.035,
          release: 0.18,
        });
      });
    });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context && this.context.state !== "closed") return this.context;

    const AudioCtor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtor) return null;

    this.context = new AudioCtor();
    return this.context;
  }

  private async resumeContext(): Promise<AudioContext | null> {
    const context = this.ensureContext();
    if (!context) return null;

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return context;
      }
    }

    return context;
  }

  private withRunningContext(callback: (context: AudioContext) => void) {
    void this.resumeContext().then((context) => {
      if (!context) return;
      if (context.state !== "running") {
        this.addUnlockListeners();
        return;
      }
      callback(context);
    });
  }

  private tone(
    context: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    options: ToneOptions = {}
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const attack = options.attack ?? 0.012;
    const release = options.release ?? 0.08;
    const volume = options.volume ?? 0.04;
    const stopTime = startTime + duration + release;

    oscillator.type = options.waveform ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(stopTime + 0.02);
  }

  private startMusicLoop() {
    const context = this.ensureContext();
    if (!context || context.state !== "running" || this.musicTimer !== null) return;

    this.scheduleMusicBar();
    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled || this.context?.state !== "running") return;
      this.scheduleMusicBar();
    }, 3200);
  }

  private stopMusicLoop() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusicBar() {
    if (!this.context) return;

    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 392];
    const bass = this.musicStep % 2 === 0 ? 130.81 : 146.83;
    const start = this.context.currentTime + 0.04;

    melody.forEach((frequency, index) => {
      this.tone(this.context!, frequency, start + index * 0.34, 0.2, {
        waveform: "sine",
        volume: 0.012,
        attack: 0.025,
        release: 0.16,
      });
    });

    this.tone(this.context, bass, start, 0.72, {
      waveform: "triangle",
      volume: 0.012,
      attack: 0.04,
      release: 0.34,
    });
    this.tone(this.context, bass * 1.5, start + 1.36, 0.72, {
      waveform: "triangle",
      volume: 0.01,
      attack: 0.04,
      release: 0.34,
    });

    this.musicStep += 1;
  }

  private addUnlockListeners() {
    if (typeof window === "undefined" || this.unlockListenersBound) return;

    window.addEventListener("pointerdown", this.unlock, { passive: true });
    window.addEventListener("keydown", this.unlock);
    this.unlockListenersBound = true;
  }

  private removeUnlockListeners() {
    if (typeof window === "undefined" || !this.unlockListenersBound) return;

    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    this.unlockListenersBound = false;
  }
}

export const blockBlastAudio = new BlockBlastAudio();
