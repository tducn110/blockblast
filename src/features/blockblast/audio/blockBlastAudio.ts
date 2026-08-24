type ToneOptions = {
  waveform?: OscillatorType;
  volume?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
};

const DESKTOP_AUDIO = {
  masterVolume: 1,
  musicVolume: 0.08,
  sfxVolume: 2.2,
};

const MOBILE_AUDIO = {
  masterVolume: 1,
  musicVolume: 0.2,
  sfxVolume: 2.2,
};

const MUSIC_ASSET_GAIN = 0.45;
const TONE_SFX_GAIN = 1.35;
const SLASH_SFX_GAIN = 1.18;

function clampVolume(volume: number) {
  const clamped = Math.min(1, Math.max(0, volume));
  return clamped;
}

export class BlockBlastAudio {
  private context: AudioContext | null = null;
  private musicEnabled = false;
  private sfxEnabled = true;
  private mobileAudioMode = false;
  private musicElement: HTMLAudioElement | null = null;
  private slashElement: HTMLAudioElement | null = null;
  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private musicGainNode: GainNode | null = null;
  private slashSourceNode: MediaElementAudioSourceNode | null = null;
  private slashGainNode: GainNode | null = null;
  private masterBgmGain: GainNode | null = null;
  private masterSfxGain: GainNode | null = null;
  private unlockListenersBound = false;
  private visibilityListenerBound = false;
  private musicPlayPromise: Promise<void> | null = null;
  private programmaticSuspend = false;

  preload() {
    this.ensureMusicElement();
    this.ensureSlashElement();
  }

  private setupWebAudioRouting() {
    const context = this.ensureContext();
    if (!context || !this.masterBgmGain || !this.masterSfxGain) return;

    if (this.musicElement && !this.musicSourceNode) {
      try {
        this.musicSourceNode = context.createMediaElementSource(this.musicElement);
        this.musicGainNode = context.createGain();
        this.musicGainNode.gain.value = this.musicVolume();
        this.musicSourceNode.connect(this.musicGainNode);
        this.musicGainNode.connect(this.masterBgmGain);
      } catch (e) {
        console.warn("Failed to route music element", e);
      }
    }

    if (this.slashElement && !this.slashSourceNode) {
      try {
        this.slashSourceNode = context.createMediaElementSource(this.slashElement);
        this.slashGainNode = context.createGain();
        this.slashGainNode.gain.value = this.sfxSlashVolume(0.62);
        this.slashSourceNode.connect(this.slashGainNode);
        this.slashGainNode.connect(this.masterSfxGain);
      } catch (e) {
        console.warn("Failed to route slash element", e);
      }
    }
  }

  private readonly handleVisibilityChange = () => {
    if (typeof document === "undefined") return;

    if (document.hidden) {
      if (this.masterBgmGain) this.masterBgmGain.gain.value = 0;
    } else {
      if (this.masterBgmGain && this.musicEnabled) {
        this.masterBgmGain.gain.value = 1;
      }
      if (this.context?.state === "suspended" && !this.programmaticSuspend) {
        this.addUnlockListeners();
      }
    }
  };

  private readonly unlock = () => {
    this.unlockFromGesture({ removeFallbackListeners: true });
  };

  unlockFromGesture({ removeFallbackListeners = false }: { removeFallbackListeners?: boolean } = {}) {
    if (this.programmaticSuspend) return;
    
    const context = this.ensureContext();
    if (context) {
      if (context.state === "suspended") {
        void context.resume().catch(() => this.addUnlockListeners());
      }
      
      // Play a silent oscillator to force iOS to unlock the Web Audio API
      try {
        const osc = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(context.currentTime);
        osc.stop(context.currentTime + 0.001);
      } catch (e) {
        // Ignore errors
      }
    }

    if (removeFallbackListeners && (!context || context.state === "running")) {
      this.removeUnlockListeners();
    }

    if (this.musicEnabled) {
      this.startMusicTrack({ fromGesture: true });
    }
  }

  setMusicEnabled(enabled: boolean, { fromGesture = false }: { fromGesture?: boolean } = {}) {
    this.musicEnabled = enabled;

    if (this.masterBgmGain) {
      this.masterBgmGain.gain.value = enabled ? 1 : 0;
    }

    if (!enabled) {
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicElement.currentTime = 0;
      }
      this.removeUnlockListeners();
      this.removeVisibilityListener();
      return;
    }

    this.addVisibilityListener();
    if (fromGesture) {
      this.startMusicTrack({ fromGesture: true });
      return;
    }

    if (this.context?.state === "running") {
      this.startMusicTrack();
    } else {
      this.addUnlockListeners();
    }
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (this.masterSfxGain) {
      this.masterSfxGain.gain.value = enabled ? 1 : 0;
    }
  }

  setMobileAudioMode(enabled: boolean) {
    if (this.mobileAudioMode === enabled) return;
    this.mobileAudioMode = enabled;
    this.applyAudioVolumes();
  }

  playButtonClick() {
    if (!this.sfxEnabled) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.006;
      this.tone(context, 587.33, now, 0.055, {
        waveform: "triangle",
        volume: this.sfxToneVolume(0.045),
        attack: 0.006,
        release: 0.045,
      });
      this.tone(context, 880, now + 0.028, 0.05, {
        waveform: "sine",
        volume: this.sfxToneVolume(0.032),
        attack: 0.004,
        release: 0.04,
      });
    });
  }

  playPlace() {
    if (!this.sfxEnabled) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 329.63, now, 0.08, { waveform: "triangle", volume: this.sfxToneVolume(0.05) });
      this.tone(context, 493.88, now + 0.045, 0.09, { waveform: "sine", volume: this.sfxToneVolume(0.035) });
    });
  }

  playInvalid() {
    if (!this.sfxEnabled) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 132, now, 0.11, { waveform: "sawtooth", volume: this.sfxToneVolume(0.025), release: 0.05 });
      this.tone(context, 118, now + 0.035, 0.1, { waveform: "sawtooth", volume: this.sfxToneVolume(0.018), release: 0.05 });
    });
  }

  playLineClear(clearedRows: number, clearedCols: number, combo: number) {
    if (!this.sfxEnabled) return;

    this.playSlashSound(Math.min(0.9, 0.5 + (clearedRows + clearedCols) * 0.08), 1 + combo * 0.02);
    this.withRunningContext((context) => {
      const lineCount = clearedRows + clearedCols;
      const now = context.currentTime + 0.01;
      
      // Add a physical "crunch" sound (short noise burst)
      this.noiseBurst(context, now, 0.12, 0.045 * Math.min(4, lineCount));

      const base = clearedRows > 0 && clearedCols > 0 ? 392 : clearedRows > 0 ? 349.23 : 329.63;

      for (let i = 0; i < Math.max(1, lineCount); i += 1) {
        // Percussive synth hit with frequency drop
        const freq = base * (1 + i * 0.16);
        this.tone(context, freq * 1.5, now + i * 0.055, 0.16, {
          waveform: "triangle",
          freqEnd: freq * 0.8, // Pitch slide down for punchiness
          volume: this.sfxToneVolume(0.065), // slightly louder to compensate for drop
          release: 0.12,
        });
      }

      if (combo > 1) {
        const finisherFreq = 659.25 + combo * 18;
        this.tone(context, finisherFreq, now + 0.13, 0.18, {
          waveform: "sine",
          volume: this.sfxToneVolume(0.04),
          release: 0.14,
        });
      }
    });
  }

  playCombo(combo: number) {
    if (!this.sfxEnabled) return;

    this.playSlashSound(0.72, Math.min(1.18, 1.03 + combo * 0.03));
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const count = Math.min(notes.length, Math.max(2, combo));

      for (let i = 0; i < count; i += 1) {
        this.tone(context, notes[i] + combo * 8, now + i * 0.05, 0.16, {
          waveform: "sine",
          volume: this.sfxToneVolume(0.035),
          release: 0.12,
        });
      }
    });
  }

  playBoom() {
    if (!this.sfxEnabled) return;

    this.playSlashSound(0.95, 0.92);
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.noiseBurst(context, now, 0.34, 0.055);
      this.tone(context, 82.41, now, 0.22, {
        waveform: "sawtooth",
        volume: this.sfxToneVolume(0.07),
        release: 0.24,
      });
      this.tone(context, 523.25, now + 0.06, 0.2, {
        waveform: "triangle",
        volume: this.sfxToneVolume(0.045),
        release: 0.18,
      });
      this.tone(context, 783.99, now + 0.13, 0.22, {
        waveform: "sine",
        volume: this.sfxToneVolume(0.04),
        release: 0.2,
      });
    });
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.musicElement) return this.musicElement;

    const audio = new Audio("/assets/audio/music.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audio.load();
    this.musicElement = audio;
    return audio;
  }

  private ensureSlashElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.slashElement) return this.slashElement;

    const audio = new Audio("/assets/audio/slash-clear.mp3");
    audio.preload = "auto";
    audio.load();
    this.slashElement = audio;
    return audio;
  }

  playGameOver() {
    if (!this.sfxEnabled) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      [392, 329.63, 261.63].forEach((frequency, index) => {
        this.tone(context, frequency, now + index * 0.1, 0.18, {
          waveform: "triangle",
          volume: this.sfxToneVolume(0.035),
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
    this.masterBgmGain = this.context.createGain();
    this.masterSfxGain = this.context.createGain();
    
    this.masterBgmGain.gain.value = this.musicEnabled ? 1 : 0;
    this.masterSfxGain.gain.value = this.sfxEnabled ? 1 : 0;
    
    this.masterBgmGain.connect(this.context.destination);
    this.masterSfxGain.connect(this.context.destination);

    this.context.onstatechange = () => {
      if (this.context?.state === "suspended") {
        this.addUnlockListeners();
      }
    };

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

  private startMusicTrack({ fromGesture = false }: { fromGesture?: boolean } = {}) {
    if (!this.musicEnabled) return;

    const audio = this.ensureMusicElement();
    if (!audio) return;

    const context = this.ensureContext();
    if (context?.state === "suspended") {
      if (!fromGesture) {
        this.addUnlockListeners();
        return;
      }
      void context.resume().catch(() => this.addUnlockListeners());
    }

    this.setupWebAudioRouting();

    const vol = this.musicVolume();
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = vol;
    }

    if (this.masterBgmGain) {
      const isHidden = typeof document !== "undefined" && document.hidden;
      this.masterBgmGain.gain.value = this.musicEnabled && !isHidden ? 1 : 0;
    }

    if (!audio.paused && !audio.ended) {
      this.removeUnlockListeners();
      return;
    }

    if (this.musicPlayPromise && !fromGesture) return;

    const playPromise = audio.play();
    this.musicPlayPromise = playPromise;
    playPromise
      .then(() => {
        this.removeUnlockListeners();
      })
      .catch(() => {
        this.addUnlockListeners();
      })
      .finally(() => {
        if (this.musicPlayPromise === playPromise) {
          this.musicPlayPromise = null;
        }
      });
  }

  private playSlashSound(volume: number, playbackRate: number) {
    const audio = this.ensureSlashElement();
    if (!audio) return;

    void this.resumeContext();
    this.setupWebAudioRouting();

    const vol = this.sfxSlashVolume(volume);
    audio.currentTime = 0;
    if (this.slashGainNode) {
      this.slashGainNode.gain.value = vol;
    }
    audio.playbackRate = Math.max(0.75, Math.min(1.35, playbackRate));
    void audio.play().catch(() => this.addUnlockListeners());
  }

  private withRunningContext(callback: (context: AudioContext) => void) {
    const context = this.ensureContext();
    if (!context) return;

    if (context.state === "suspended") {
      this.addUnlockListeners();
      void context.resume().catch(() => this.addUnlockListeners());
    }
    
    // Call synchronously so Safari schedules the Web Audio event within the same user gesture frame
    callback(context);
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
    if (options.freqEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(options.freqEnd, startTime + attack + 0.05);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(gain);
    if (this.masterSfxGain) {
      gain.connect(this.masterSfxGain);
    }
    oscillator.start(startTime);
    oscillator.stop(stopTime + 0.02);
  }

  private noiseBurst(
    context: AudioContext,
    startTime: number,
    duration: number,
    volume: number
  ) {
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i += 1) {
      const fade = 1 - i / sampleCount;
      output[i] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, startTime);
    filter.frequency.exponentialRampToValueAtTime(180, startTime + duration);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(this.sfxToneVolume(volume), startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    if (this.masterSfxGain) {
      gain.connect(this.masterSfxGain);
    }
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }

  private addUnlockListeners() {
    if (typeof window === "undefined" || this.unlockListenersBound) return;

    window.addEventListener("pointerdown", this.unlock, { capture: true, passive: true });
    window.addEventListener("touchstart", this.unlock, { capture: true, passive: true });
    window.addEventListener("keydown", this.unlock, { capture: true, passive: true });
    this.unlockListenersBound = true;
  }

  private removeUnlockListeners() {
    if (typeof window === "undefined" || !this.unlockListenersBound) return;

    window.removeEventListener("pointerdown", this.unlock, { capture: true });
    window.removeEventListener("touchstart", this.unlock, { capture: true });
    window.removeEventListener("keydown", this.unlock, { capture: true });
    this.unlockListenersBound = false;
  }

  private audioConfig() {
    const isMobile = () => {
      if (typeof window === "undefined") return false;
      const uaMatch = /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent);
      const widthMatch = window.matchMedia("(max-width: 1024px)").matches;
      const touchMatch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      return uaMatch || widthMatch || touchMatch;
    };
    const forceMobile = this.mobileAudioMode || isMobile();
    const config = forceMobile ? MOBILE_AUDIO : DESKTOP_AUDIO;
    return config;
  }

  private musicVolume() {
    const config = this.audioConfig();
    const calculated = clampVolume(config.masterVolume * config.musicVolume * MUSIC_ASSET_GAIN);
    return calculated;
  }

  private sfxToneVolume(volume: number) {
    const config = this.audioConfig();
    const calculated = clampVolume(config.masterVolume * config.sfxVolume * volume * TONE_SFX_GAIN);
    return calculated;
  }

  private sfxSlashVolume(volume: number) {
    const config = this.audioConfig();
    const calculated = clampVolume(config.masterVolume * config.sfxVolume * volume * SLASH_SFX_GAIN);
    return calculated;
  }

  private applyAudioVolumes() {
    const vol = this.musicVolume();
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = vol;
    }
  }

  private addVisibilityListener() {
    if (typeof document === "undefined" || this.visibilityListenerBound) return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.visibilityListenerBound = true;
  }

  private removeVisibilityListener() {
    if (typeof document === "undefined" || !this.visibilityListenerBound) return;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.visibilityListenerBound = false;
  }

  dispose() {
    this.removeUnlockListeners();
    this.removeVisibilityListener();
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
    }
    if (this.slashElement) {
      this.slashElement.pause();
      this.slashElement.currentTime = 0;
    }
    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
    this.context = null;
    this.masterBgmGain = null;
    this.masterSfxGain = null;
    this.musicGainNode = null;
    this.slashGainNode = null;
    this.musicSourceNode = null;
    this.slashSourceNode = null;
    this.musicElement = null;
    this.slashElement = null;
  }

  suspend() {
    this.programmaticSuspend = true;
    if (this.context && this.context.state === "running") {
      void this.context.suspend();
    }
  }

  resume() {
    this.programmaticSuspend = false;
    if (this.context && this.context.state === "suspended") {
      void this.context.resume().catch(() => this.addUnlockListeners());
    }
  }
}

export const blockBlastAudio = new BlockBlastAudio();
