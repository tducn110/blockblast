type ToneOptions = {
  waveform?: OscillatorType;
  volume?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
};

/**
 * Calibrated audio volume preset following 01_fruit and 02_2048 sound design standards:
 * - Master is full scale (1.0) with DynamicsCompressor providing safety headroom against clipping.
 * - BGM sits comfortably in the background (0.22 gameplay / 0.30 landing).
 * - SFX are prominent and punchy (0.60 - 0.95), clearly louder than BGM (ratio ~2.8x - 4.1x).
 * - BGM ducking (factor 0.40) dips music during high-impact events (clears, combos, boom)
 *   so sound effects pop with full clarity.
 */
export const AUDIO_VOLUME = {
  master: 1.0,
  landingBgm: 0.30,
  gameBgm: 0.22,
  button: 0.65,
  place: 0.70,
  invalid: 0.60,
  lineClear: 0.85,
  combo: 0.80,
  boom: 0.90,
  gameOver: 0.80,
  slash: 0.85,
} as const;

export const LANDING_BGM_VOLUME = AUDIO_VOLUME.landingBgm;
export const GAME_BGM_VOLUME = AUDIO_VOLUME.gameBgm;

const DESKTOP_AUDIO = {
  masterVolume: AUDIO_VOLUME.master,
  sfxVolume: 1.0,
};

const MOBILE_AUDIO = {
  masterVolume: AUDIO_VOLUME.master,
  sfxVolume: 1.0,
};

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, volume));
}

// ponytail: dual-engine architecture. HTML5 Audio streams BGM (saving 20-30MB RAM on mobile),
// while Web Audio API handles polyphonic SFX with sample-accurate dynamics limiting.
export class BlockBlastAudio {
  private context: AudioContext | null = null;
  private musicEnabled = false;
  private sfxEnabled = true;
  private hostMuted = false;
  private hostPaused = false;
  private isPausedAll = false;
  private isWindowFocused = true;
  private unlocked = false;
  private mobileAudioMode = false;
  private currentBgmVolume: number = GAME_BGM_VOLUME;
  private isDucked = false;
  private duckTimer: number | null = null;

  private musicElement: HTMLAudioElement | null = null;
  private slashElement: HTMLAudioElement | null = null;
  private slashBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private masterSfxGain: GainNode | null = null;
  private masterBusGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private unlockListenersBound = false;
  private lifecycleListenersBound = false;
  private musicPlayPromise: Promise<void> | null = null;
  private activeNodes = new Set<AudioScheduledSourceNode>();

  async preload(): Promise<void> {
    this.addLifecycleListeners();
    const context = this.ensureContext();
    this.ensureMusicElement();
    this.ensureSlashElement();
    await this.loadSlashBuffer();
    if (context) {
      this.getNoiseBuffer(context);
    }
  }

  private registerActiveNode(node: AudioScheduledSourceNode) {
    this.activeNodes.add(node);
    const cleanup = () => {
      this.activeNodes.delete(node);
    };
    if (typeof node.addEventListener === "function") {
      node.addEventListener("ended", cleanup, { once: true });
    } else {
      node.onended = cleanup;
    }
  }

  // ponytail: standard stop() and disconnect() cleanups ensure no sound leaks from scheduled WebAudio nodes
  private stopAllWebAudio() {
    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
      try {
        node.disconnect();
      } catch {
        // already disconnected
      }
    }
    this.activeNodes.clear();
  }

  // ponytail: silenceAll enforces Wink contract pause behavior by cutting all audio across HTML5 and Web Audio
  private silenceAll() {
    if (this.musicElement) {
      this.musicElement.pause();
    }
    this.musicPlayPromise = null;
    if (this.slashElement) {
      this.slashElement.pause();
    }
    this.stopAllWebAudio();
    this.applySfxMuteState();
    if (
      this.context &&
      typeof this.context.suspend === "function" &&
      this.context.state === "running"
    ) {
      void this.context.suspend().catch(() => {});
    }
  }

  private isFocusLost(): boolean {
    if (typeof document === "undefined") return false;
    if (document.hidden) return true;
    return !this.isWindowFocused;
  }

  private async loadSlashBuffer(): Promise<void> {
    if (this.slashBuffer || typeof window === "undefined" || typeof fetch === "undefined") return;
    try {
      const url = typeof window !== "undefined" && window.location?.origin
        ? new URL("/assets/audio/slash-clear.mp3", window.location.href).href
        : "/assets/audio/slash-clear.mp3";
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const context = this.ensureContext();
      if (context && typeof context.decodeAudioData === "function") {
        this.slashBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          const res = context.decodeAudioData(arrayBuffer, resolve, reject);
          if (res && typeof res.then === "function") {
            res.then(resolve, reject);
          }
        });
      }
    } catch {
      // Fallback to HTMLAudioElement if fetch or decodeAudioData is unavailable
    }
  }

  private readonly handleVisibilityChange = () => {
    if (typeof document === "undefined") return;

    if (document.hidden) {
      this.isWindowFocused = false;
      this.pauseAll();
    } else {
      this.isWindowFocused = true;
      if (this.canPlayBgm()) {
        this.resumeBgm();
      }
      if (this.context?.state === "suspended") {
        this.addUnlockListeners();
      }
    }
  };

  private readonly handleBlur = () => {
    this.isWindowFocused = false;
    this.pauseAll();
  };

  private readonly handleFocus = () => {
    this.isWindowFocused = true;
    if (!this.hostPaused && !this.hostMuted) {
      this.isPausedAll = false;
      this.applySfxMuteState();
      if (
        this.context &&
        typeof this.context.resume === "function" &&
        this.context.state === "suspended" &&
        this.unlocked
      ) {
        void this.context.resume().catch(() => {});
      }
      if (this.canPlayBgm()) {
        this.resumeBgm();
      }
    }
  };

  private readonly unlock = () => {
    void this.unlockFromGesture({ removeFallbackListeners: true });
  };

  async unlockFromGesture({ removeFallbackListeners = false }: { removeFallbackListeners?: boolean } = {}): Promise<boolean> {
    this.unlocked = true;
    const context = this.ensureContext();
    let resumePromise: Promise<void> = Promise.resolve();
    if (context) {
      if (context.state === "suspended") {
        resumePromise = context.resume().catch(() => this.addUnlockListeners());
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
      } catch {
        // Ignore errors
      }
    }

    if (this.canPlayBgm()) {
      this.startMusicTrack({ fromGesture: true });
    }

    if (!this.slashBuffer) {
      void this.loadSlashBuffer();
    }

    await resumePromise;
    const ready = !context || context.state === "running";
    if (removeFallbackListeners && ready) this.removeUnlockListeners();
    return ready;
  }

  setMusicEnabled(enabled: boolean, { fromGesture = false }: { fromGesture?: boolean } = {}) {
    this.musicEnabled = enabled;

    if (!enabled) {
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicElement.currentTime = 0;
      }
      this.musicPlayPromise = null;
      this.removeUnlockListeners();
      this.removeVisibilityListener();
      return;
    }

    this.addVisibilityListener();
    if (fromGesture) {
      this.startMusicTrack({ fromGesture: true });
      return;
    }

    if (this.unlocked || this.context?.state === "running") {
      this.startMusicTrack();
    } else {
      this.addUnlockListeners();
    }
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    this.applySfxMuteState();
  }

  setHostMuted(muted: boolean) {
    this.hostMuted = muted;
    this.applySfxMuteState();
    if (muted) {
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicPlayPromise = null;
      }
      if (this.slashElement) {
        this.slashElement.pause();
      }
      this.stopAllWebAudio();
    } else if (this.canPlayBgm() && this.unlocked) {
      this.resumeBgm();
    }
  }

  setHostPaused(paused: boolean) {
    this.hostPaused = paused;
    if (paused) {
      this.silenceAll();
    } else {
      this.isPausedAll = false;
      this.applySfxMuteState();
      if (
        this.context &&
        typeof this.context.resume === "function" &&
        this.context.state === "suspended" &&
        this.unlocked &&
        !this.hostMuted &&
        !this.isFocusLost()
      ) {
        void this.context.resume().catch(() => {});
      }
      if (this.canPlayBgm() && this.unlocked) {
        this.resumeBgm();
      }
    }
  }

  setBgmVolume(volume: number) {
    this.currentBgmVolume = clampVolume(volume);
    this.applyBgmVolume();
  }

  duckBgm(durationMs = 280) {
    if (!this.musicElement || !this.canPlayBgm()) return;
    this.isDucked = true;
    this.applyBgmVolume();

    if (this.duckTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.duckTimer);
    }
    if (typeof window !== "undefined") {
      this.duckTimer = window.setTimeout(() => {
        this.isDucked = false;
        this.duckTimer = null;
        this.applyBgmVolume();
      }, durationMs);
    }
  }

  // ponytail: pauseAll halts all audio immediately and flags pause state
  pauseAll() {
    this.isPausedAll = true;
    this.silenceAll();
  }

  resumeBgm() {
    this.isPausedAll = false;
    this.applySfxMuteState();
    if (
      this.context &&
      typeof this.context.resume === "function" &&
      this.context.state === "suspended" &&
      this.unlocked &&
      !this.hostPaused &&
      !this.hostMuted &&
      !this.isFocusLost()
    ) {
      void this.context.resume().catch(() => {});
    }
    if (!this.canPlayBgm()) return;
    this.startMusicTrack();
  }

  setMobileAudioMode(enabled: boolean) {
    if (this.mobileAudioMode === enabled) return;
    this.mobileAudioMode = enabled;
    this.applyBgmVolume();
  }

  get isBgmPlaying(): boolean {
    return Boolean(this.musicElement && !this.musicElement.paused && !this.musicElement.ended);
  }

  get landingBgmVolume(): number {
    return LANDING_BGM_VOLUME;
  }

  get gameBgmVolume(): number {
    return GAME_BGM_VOLUME;
  }

  get audioVolume() {
    return AUDIO_VOLUME;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  get isHostMuted(): boolean {
    return this.hostMuted;
  }

  get isHostPaused(): boolean {
    return this.hostPaused;
  }

  get isPaused(): boolean {
    return this.hostPaused || this.isPausedAll || this.isFocusLost();
  }

  get isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  get isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  private canPlayBgm(): boolean {
    return this.musicEnabled && !this.hostMuted && !this.hostPaused && !this.isPausedAll && !this.isFocusLost();
  }

  private canPlaySfx(): boolean {
    return this.sfxEnabled && !this.hostMuted && !this.hostPaused && !this.isPausedAll && !this.isFocusLost();
  }

  private applySfxMuteState() {
    const sfxAllowed = this.canPlaySfx();
    if (this.masterSfxGain) {
      this.masterSfxGain.gain.value = sfxAllowed ? 1 : 0;
    }
    if (this.masterBusGain) {
      const isSafari =
        typeof navigator !== "undefined" &&
        (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
          /iPad|iPhone|iPod/.test(navigator.userAgent));
      this.masterBusGain.gain.value = sfxAllowed ? (isSafari ? 1.4 : 1.0) : 0;
    }
  }

  playButtonClick() {
    if (!this.canPlaySfx()) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.006;
      this.tone(context, 587.33, now, 0.055, {
        waveform: "triangle",
        volume: this.sfxToneVolume(AUDIO_VOLUME.button),
        attack: 0.006,
        release: 0.045,
      });
      this.tone(context, 880, now + 0.028, 0.05, {
        waveform: "sine",
        volume: this.sfxToneVolume(AUDIO_VOLUME.button * 0.7),
        attack: 0.004,
        release: 0.04,
      });
    });
  }

  playPlace() {
    if (!this.canPlaySfx()) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 329.63, now, 0.08, {
        waveform: "triangle",
        volume: this.sfxToneVolume(AUDIO_VOLUME.place),
      });
      this.tone(context, 493.88, now + 0.045, 0.09, {
        waveform: "sine",
        volume: this.sfxToneVolume(AUDIO_VOLUME.place * 0.7),
      });
    });
  }

  playInvalid() {
    if (!this.canPlaySfx()) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.tone(context, 132, now, 0.11, {
        waveform: "sawtooth",
        volume: this.sfxToneVolume(AUDIO_VOLUME.invalid),
        release: 0.05,
      });
      this.tone(context, 118, now + 0.035, 0.1, {
        waveform: "sawtooth",
        volume: this.sfxToneVolume(AUDIO_VOLUME.invalid * 0.7),
        release: 0.05,
      });
    });
  }

  playLineClear(clearedRows: number, clearedCols: number, combo: number) {
    if (!this.canPlaySfx()) return;

    const lineCount = clearedRows + clearedCols;
    if (lineCount >= 2 || combo > 1) {
      this.duckBgm(260);
    }

    this.playSlashSound(
      Math.min(0.95, AUDIO_VOLUME.slash + Math.max(0, lineCount - 1) * 0.03),
      1 + combo * 0.02
    );
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      
      // Add a physical "crunch" sound (short noise burst)
      this.noiseBurst(context, now, 0.12, Math.min(0.75, 0.50 + lineCount * 0.06));

      const base = clearedRows > 0 && clearedCols > 0 ? 392 : clearedRows > 0 ? 349.23 : 329.63;

      for (let i = 0; i < Math.max(1, lineCount); i += 1) {
        // Percussive synth hit with frequency drop
        const freq = base * (1 + i * 0.16);
        this.tone(context, freq * 1.5, now + i * 0.055, 0.16, {
          waveform: "triangle",
          freqEnd: freq * 0.8, // Pitch slide down for punchiness
          volume: this.sfxToneVolume(AUDIO_VOLUME.lineClear),
          release: 0.12,
        });
      }

      if (combo > 1) {
        const finisherFreq = 659.25 + combo * 18;
        this.tone(context, finisherFreq, now + 0.13, 0.18, {
          waveform: "sine",
          volume: this.sfxToneVolume(AUDIO_VOLUME.lineClear * 0.75),
          release: 0.14,
        });
      }
    });
  }

  playCombo(combo: number) {
    if (!this.canPlaySfx()) return;

    if (combo > 1) {
      this.duckBgm(240);
    }

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const count = Math.min(notes.length, Math.max(2, combo));
      const comboVolume = Math.min(0.92, AUDIO_VOLUME.combo + Math.min(4, combo - 1) * 0.03);

      for (let i = 0; i < count; i += 1) {
        this.tone(context, notes[i] + combo * 8, now + i * 0.05, 0.16, {
          waveform: "sine",
          volume: this.sfxToneVolume(comboVolume),
          release: 0.12,
        });
      }
    });
  }

  playBoom() {
    if (!this.canPlaySfx()) return;

    this.duckBgm(340);
    this.playSlashSound(0.95, 0.92);
    this.withRunningContext((context) => {
      const now = context.currentTime + 0.01;
      this.noiseBurst(context, now, 0.34, 0.75);
      this.tone(context, 82.41, now, 0.22, {
        waveform: "sawtooth",
        volume: this.sfxToneVolume(AUDIO_VOLUME.boom),
        release: 0.24,
      });
      this.tone(context, 523.25, now + 0.06, 0.2, {
        waveform: "triangle",
        volume: this.sfxToneVolume(AUDIO_VOLUME.boom * 0.75),
        release: 0.18,
      });
      this.tone(context, 783.99, now + 0.13, 0.22, {
        waveform: "sine",
        volume: this.sfxToneVolume(AUDIO_VOLUME.boom * 0.65),
        release: 0.2,
      });
    });
  }

  playGameOver() {
    if (!this.canPlaySfx()) return;

    this.withRunningContext((context) => {
      const now = context.currentTime + 0.02;
      [392, 329.63, 261.63].forEach((frequency, index) => {
        this.tone(context, frequency, now + index * 0.1, 0.18, {
          waveform: "triangle",
          volume: this.sfxToneVolume(AUDIO_VOLUME.gameOver),
          release: 0.18,
        });
      });
    });
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.musicElement) return this.musicElement;

    const audio = new Audio("/assets/audio/music.mp3");
    audio.loop = true;
    audio.preload = "auto";
    if (typeof audio.setAttribute === "function") {
      audio.setAttribute("playsinline", "true");
    }
    audio.load();
    this.musicElement = audio;
    return audio;
  }

  private ensureSlashElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.slashElement) return this.slashElement;

    const audio = new Audio("/assets/audio/slash-clear.mp3");
    audio.preload = "auto";
    if (typeof audio.setAttribute === "function") {
      audio.setAttribute("playsinline", "true");
    }
    audio.load();
    this.slashElement = audio;
    return audio;
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
    this.masterSfxGain = this.context.createGain();
    this.masterBusGain = this.context.createGain();
    
    const isSafari =
      typeof navigator !== "undefined" &&
      (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
        /iPad|iPhone|iPod/.test(navigator.userAgent));

    this.masterSfxGain.gain.value = this.canPlaySfx() ? 1 : 0;
    this.masterBusGain.gain.value = isSafari ? 1.4 : 1.0;
    
    this.masterSfxGain.connect(this.masterBusGain);

    if (typeof navigator !== "undefined" && "audioSession" in navigator) {
      try {
        (navigator as unknown as { audioSession: { type: string } }).audioSession.type = "playback";
      } catch {
        // Ignore audioSession failure
      }
    }

    if (typeof this.context.createDynamicsCompressor === "function") {
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-3.0, this.context.currentTime);
      limiter.knee.setValueAtTime(4.0, this.context.currentTime);
      limiter.ratio.setValueAtTime(20.0, this.context.currentTime);
      limiter.attack.setValueAtTime(0.003, this.context.currentTime);
      limiter.release.setValueAtTime(0.12, this.context.currentTime);

      this.masterBusGain.connect(limiter);
      limiter.connect(this.context.destination);
      this.masterLimiter = limiter;
    } else {
      this.masterBusGain.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      this.addUnlockListeners();
    }

    this.context.onstatechange = () => {
      if (this.context?.state === "suspended") {
        this.addUnlockListeners();
      }
    };

    return this.context;
  }

  private startMusicTrack({ fromGesture = false }: { fromGesture?: boolean } = {}) {
    if (!this.canPlayBgm()) return;

    const audio = this.ensureMusicElement();
    if (!audio) return;

    const context = this.ensureContext();
    if (context?.state === "suspended") {
      if (fromGesture) {
        void context.resume().catch(() => this.addUnlockListeners());
      } else {
        this.addUnlockListeners();
      }
    }

    this.applyBgmVolume();

    if (!audio.paused && !audio.ended) {
      this.unlocked = true;
      this.removeUnlockListeners();
      return;
    }

    if (this.musicPlayPromise && !fromGesture) return;

    let playResult: Promise<void> | undefined;
    try {
      playResult = audio.play();
    } catch {
      this.addUnlockListeners();
      return;
    }

    const playPromise = Promise.resolve(playResult);
    this.musicPlayPromise = playPromise;

    playPromise
      .then(() => {
        this.unlocked = true;
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
    const context = this.ensureContext();
    if (context && this.slashBuffer) {
      try {
        if (context.state === "suspended") {
          void context.resume().catch(() => {});
        }
        const source = context.createBufferSource();
        this.registerActiveNode(source);
        source.buffer = this.slashBuffer;
        source.playbackRate.value = Math.max(0.75, Math.min(1.35, playbackRate));
        const gain = context.createGain();
        gain.gain.value = this.sfxSlashVolume(volume);
        source.connect(gain);
        if (this.masterSfxGain) {
          gain.connect(this.masterSfxGain);
        } else {
          gain.connect(context.destination);
        }
        source.start();
        return;
      } catch {
        // Fallback to audio element
      }
    }

    if (!this.slashBuffer) {
      void this.loadSlashBuffer();
    }

    const audio = this.ensureSlashElement();
    if (!audio) return;

    const vol = this.sfxSlashVolume(volume);
    audio.currentTime = 0;
    audio.volume = vol;
    audio.playbackRate = Math.max(0.75, Math.min(1.35, playbackRate));
    void audio.play().catch(() => this.addUnlockListeners());
  }

  private withRunningContext(callback: (context: AudioContext) => void) {
    if (!this.canPlaySfx()) return;
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
    this.registerActiveNode(oscillator);
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

  private getNoiseBuffer(context: AudioContext): AudioBuffer | null {
    if (typeof context.createBuffer !== "function") return null;
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) {
      return this.noiseBuffer;
    }
    const sampleRate = context.sampleRate || 44100;
    const sampleCount = Math.floor(sampleRate * 0.4);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private noiseBurst(
    context: AudioContext,
    startTime: number,
    duration: number,
    volume: number
  ) {
    const buffer = this.getNoiseBuffer(context);
    if (!buffer) return;
    const source = context.createBufferSource();
    this.registerActiveNode(source);
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
    window.addEventListener("touchend", this.unlock, { capture: true, passive: true });
    window.addEventListener("keydown", this.unlock, { capture: true, passive: true });
    this.unlockListenersBound = true;
  }

  private removeUnlockListeners() {
    if (typeof window === "undefined" || !this.unlockListenersBound) return;

    window.removeEventListener("pointerdown", this.unlock, { capture: true });
    window.removeEventListener("touchstart", this.unlock, { capture: true });
    window.removeEventListener("touchend", this.unlock, { capture: true });
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
    const duckFactor = this.isDucked ? 0.4 : 1.0;
    const calculated = clampVolume(config.masterVolume * this.currentBgmVolume * duckFactor);
    return calculated;
  }

  private sfxToneVolume(volume: number) {
    const config = this.audioConfig();
    const calculated = clampVolume(config.masterVolume * config.sfxVolume * volume);
    return calculated;
  }

  private sfxSlashVolume(volume: number) {
    const config = this.audioConfig();
    const calculated = clampVolume(config.masterVolume * config.sfxVolume * volume);
    return calculated;
  }

  private applyBgmVolume() {
    if (this.musicElement) {
      this.musicElement.volume = this.musicVolume();
    }
  }

  private addLifecycleListeners() {
    if (typeof window === "undefined" || this.lifecycleListenersBound) return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    this.lifecycleListenersBound = true;
  }

  private removeLifecycleListeners() {
    if (typeof window === "undefined" || !this.lifecycleListenersBound) return;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
    this.lifecycleListenersBound = false;
  }

  private addVisibilityListener() {
    this.addLifecycleListeners();
  }

  private removeVisibilityListener() {
    // Keep lifecycle listeners active for blur/focus handling unless disposed
  }

  dispose() {
    this.removeUnlockListeners();
    this.removeLifecycleListeners();
    this.stopAllWebAudio();
    if (this.duckTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
      this.musicElement.removeAttribute("src");
      this.musicElement.load();
    }
    if (this.slashElement) {
      this.slashElement.pause();
      this.slashElement.currentTime = 0;
      this.slashElement.removeAttribute("src");
      this.slashElement.load();
    }
    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
    if (this.masterLimiter) {
      this.masterLimiter.disconnect();
      this.masterLimiter = null;
    }
    if (this.masterBusGain) {
      this.masterBusGain.disconnect();
      this.masterBusGain = null;
    }
    if (this.masterSfxGain) {
      this.masterSfxGain.disconnect();
      this.masterSfxGain = null;
    }
    this.context = null;
    this.masterSfxGain = null;
    this.masterBusGain = null;
    this.musicElement = null;
    this.slashElement = null;
    this.slashBuffer = null;
    this.noiseBuffer = null;
    this.musicPlayPromise = null;
    this.unlocked = false;
  }
}

export const blockBlastAudio = new BlockBlastAudio();
