// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockBlastAudio, AUDIO_VOLUME, LANDING_BGM_VOLUME, GAME_BGM_VOLUME } from "./blockBlastAudio";

type MockAudioElement = HTMLAudioElement & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  setAttribute: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
};

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("BlockBlastAudio music lifecycle & boundaries", () => {
  let audioCtor: ReturnType<typeof vi.fn>;
  let createdAudio: MockAudioElement[];
  let failNextMusicPlay: boolean;
  let fakeContext: {
    state: "suspended" | "running";
    destination: object;
    currentTime: number;
    resume: ReturnType<typeof vi.fn>;
    suspend: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    createMediaElementSource: ReturnType<typeof vi.fn>;
    createOscillator?: ReturnType<typeof vi.fn>;
    createBufferSource?: ReturnType<typeof vi.fn>;
    createBiquadFilter?: ReturnType<typeof vi.fn>;
  };
  let previousAudio: typeof globalThis.Audio | undefined;
  let previousAudioContext: typeof window.AudioContext | undefined;
  let previousMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    createdAudio = [];
    failNextMusicPlay = false;

    audioCtor = vi.fn(function AudioMock(_src?: string) {
      const element = {
        loop: false,
        preload: "none",
        paused: true,
        ended: false,
        currentTime: 0,
        volume: 1,
        load: vi.fn(),
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        play: vi.fn().mockImplementation(async function (this: MockAudioElement) {
          if (failNextMusicPlay) {
            failNextMusicPlay = false;
            throw new Error("music play blocked");
          }

          (this as unknown as { paused: boolean }).paused = false;
        }),
        pause: vi.fn().mockImplementation(function (this: MockAudioElement) {
          (this as unknown as { paused: boolean }).paused = true;
        }),
      } as unknown as MockAudioElement;
      createdAudio.push(element);
      return element;
    });

    fakeContext = {
      state: "suspended",
      destination: {},
      currentTime: 0,
      resume: vi.fn().mockImplementation(async () => {
        fakeContext.state = "running";
      }),
      suspend: vi.fn().mockImplementation(async () => {
        fakeContext.state = "suspended";
      }),
      close: vi.fn().mockResolvedValue(undefined),
      createGain: vi.fn(() => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        type: "sine",
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        addEventListener: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: "lowpass",
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
    };

    previousAudio = globalThis.Audio;
    previousAudioContext = window.AudioContext;
    previousMatchMedia = window.matchMedia;

    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: audioCtor,
    });

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: vi.fn(function AudioContextMock() {
        return fakeContext;
      }),
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    if (previousAudio) {
      Object.defineProperty(globalThis, "Audio", {
        configurable: true,
        writable: true,
        value: previousAudio,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Audio;
    }

    if (previousAudioContext) {
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        writable: true,
        value: previousAudioContext,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).AudioContext;
    }

    if (previousMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: previousMatchMedia,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    }
  });

  it("does not attempt autoplay outside a trusted gesture while the context is suspended", () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true);

    expect(createdAudio).toHaveLength(0);
    expect(fakeContext.resume).not.toHaveBeenCalled();
  });

  it("retries music playback on the next trusted gesture after a rejected play()", async () => {
    failNextMusicPlay = true;

    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.play).toHaveBeenCalledTimes(1);

    await audio.unlockFromGesture();
    await flushMicrotasks();

    expect(musicElement.play).toHaveBeenCalledTimes(2);
  });

  it("starts music from the enabling gesture and keeps a single active instance without createMediaElementSource", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(fakeContext.resume).toHaveBeenCalledTimes(1);
    expect(musicElement.play).toHaveBeenCalledTimes(1);

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    expect(musicElement.play).toHaveBeenCalledTimes(1);
    // Dual-Engine architecture: BGM is pure HTML5 Audio to prevent suspended context muting on mobile
    expect(fakeContext.createMediaElementSource).not.toHaveBeenCalled();
  });

  it("pauses the existing music element when music is turned off", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];

    audio.setMusicEnabled(false);

    expect(musicElement.pause).toHaveBeenCalledTimes(1);
    expect(musicElement.paused).toBe(true);
  });

  it("preloads audio elements, context, and buffers safely without throwing", async () => {
    const audio = new BlockBlastAudio();

    await expect(audio.preload()).resolves.toBeUndefined();
    // Preloads both music and slash elements
    expect(createdAudio.length).toBeGreaterThanOrEqual(2);
    expect(createdAudio[0].load).toHaveBeenCalled();
    expect(createdAudio[1].load).toHaveBeenCalled();
  });

  it("primes both WebAudio and HTML5 SFX alongside BGM in a single unlockFromGesture call", async () => {
    const audio = new BlockBlastAudio();
    await audio.preload();
    audio.setMusicEnabled(true);

    const musicElement = createdAudio[0];
    const slashElement = createdAudio[1];
    expect(musicElement.paused).toBe(true);

    // Single touch gesture calls unlockFromGesture
    await audio.unlockFromGesture();
    await flushMicrotasks();

    // 1. WebAudio context resumed
    expect(fakeContext.resume).toHaveBeenCalled();
    // 2. Silent oscillator created to unlock iOS Web Audio
    expect(fakeContext.createOscillator).toHaveBeenCalled();
    // 3. HTML5 SFX element primed with play
    expect(slashElement.play).toHaveBeenCalled();
    // 4. BGM started
    expect(musicElement.play).toHaveBeenCalled();
    expect(musicElement.paused).toBe(false);
  });

  it("triggers unlockFromGesture automatically on user touch/pointerdown after preload", async () => {
    const audio = new BlockBlastAudio();
    await audio.preload();
    audio.setMusicEnabled(true);

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(true);

    // User taps anywhere on the screen
    window.dispatchEvent(new Event("pointerdown"));
    await flushMicrotasks();

    expect(fakeContext.resume).toHaveBeenCalled();
    expect(musicElement.paused).toBe(false);
  });

  it("pauses BGM when host is paused and resumes when unpaused", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(false);

    audio.setHostPaused(true);
    expect(musicElement.pause).toHaveBeenCalledTimes(1);
    expect(musicElement.paused).toBe(true);

    audio.setHostPaused(false);
    await flushMicrotasks();
    expect(musicElement.play).toHaveBeenCalledTimes(2);
    expect(musicElement.paused).toBe(false);
  });

  it("mutes/pauses BGM when host is muted without resetting currentTime, and resumes when unmuted", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    musicElement.currentTime = 42;

    audio.setHostMuted(true);
    expect(musicElement.pause).toHaveBeenCalledTimes(1);
    expect(musicElement.paused).toBe(true);
    // Boundary contract: currentTime must NOT be reset to 0 on host mute
    expect(musicElement.currentTime).toBe(42);

    audio.setHostMuted(false);
    await flushMicrotasks();
    expect(musicElement.play).toHaveBeenCalledTimes(2);
  });

  it("silences audio on pauseAll() and resumes on resumeBgm()", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(false);

    audio.pauseAll();
    expect(musicElement.pause).toHaveBeenCalledTimes(1);
    expect(musicElement.paused).toBe(true);

    audio.resumeBgm();
    await flushMicrotasks();
    expect(musicElement.play).toHaveBeenCalledTimes(2);
  });

  it("adjusts BGM volume based on screen boundaries (landing vs game)", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];

    audio.setBgmVolume(LANDING_BGM_VOLUME);
    expect(musicElement.volume).toBeCloseTo(LANDING_BGM_VOLUME, 2);

    audio.setBgmVolume(GAME_BGM_VOLUME);
    expect(musicElement.volume).toBeCloseTo(GAME_BGM_VOLUME, 2);
  });

  it("ducks BGM volume temporarily on duckBgm", async () => {
    vi.useFakeTimers();
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    audio.setBgmVolume(GAME_BGM_VOLUME);
    const normalVolume = musicElement.volume;

    audio.duckBgm(280);
    expect(musicElement.volume).toBeLessThan(normalVolume);
    expect(musicElement.volume).toBeCloseTo(normalVolume * 0.4, 2);

    vi.advanceTimersByTime(300);
    expect(musicElement.volume).toBeCloseTo(normalVolume, 2);
    vi.useRealTimers();
  });

  it("suspends context and blocks SFX on pauseAll()", async () => {
    const audio = new BlockBlastAudio();
    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    expect(fakeContext.state).toBe("running");
    expect(audio.isPaused).toBe(false);

    audio.pauseAll();
    expect(audio.isPaused).toBe(true);
    expect(fakeContext.suspend).toHaveBeenCalledTimes(1);

    // SFX should be completely blocked while paused
    expect(fakeContext.createOscillator).not.toHaveBeenCalled();
    audio.playButtonClick();
    audio.playPlace();
    expect(fakeContext.createOscillator).not.toHaveBeenCalled();
  });

  it("handles window blur and focus lifecycle events properly", async () => {
    const audio = new BlockBlastAudio();
    await audio.preload();
    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(false);

    // Window blur pauses audio
    window.dispatchEvent(new Event("blur"));
    expect(audio.isPaused).toBe(true);
    expect(musicElement.paused).toBe(true);

    // Window focus restores audio
    window.dispatchEvent(new Event("focus"));
    await flushMicrotasks();
    expect(audio.isPaused).toBe(false);
    expect(musicElement.paused).toBe(false);
  });

  it("does not restore audio on focus when hostPaused is true", async () => {
    const audio = new BlockBlastAudio();
    await audio.preload();
    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(false);

    audio.setHostPaused(true);
    expect(audio.isPaused).toBe(true);
    expect(musicElement.paused).toBe(true);

    // Regaining window focus must NOT resume audio while hostPaused is active
    window.dispatchEvent(new Event("focus"));
    await flushMicrotasks();
    expect(audio.isPaused).toBe(true);
    expect(musicElement.paused).toBe(true);
  });

  it("does not restore audio on focus when hostMuted is true", async () => {
    const audio = new BlockBlastAudio();
    await audio.preload();
    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(musicElement.paused).toBe(false);

    audio.setHostMuted(true);
    expect(musicElement.paused).toBe(true);

    // Regaining window focus must NOT resume audio while hostMuted is active
    window.dispatchEvent(new Event("focus"));
    await flushMicrotasks();
    expect(musicElement.paused).toBe(true);
  });
});

describe("BlockBlastAudio volume calibration & SFX-to-BGM ratio standards (01_fruit & 02_2048)", () => {
  it("defines standard volume constants aligned with 01_fruit and 02_2048", () => {
    expect(AUDIO_VOLUME.gameBgm).toBe(0.22);
    expect(AUDIO_VOLUME.landingBgm).toBe(0.30);
    expect(AUDIO_VOLUME.button).toBe(0.65);
    expect(AUDIO_VOLUME.place).toBe(0.70);
    expect(AUDIO_VOLUME.invalid).toBe(0.60);
    expect(AUDIO_VOLUME.lineClear).toBe(0.85);
    expect(AUDIO_VOLUME.combo).toBe(0.80);
    expect(AUDIO_VOLUME.boom).toBe(0.90);
    expect(AUDIO_VOLUME.gameOver).toBe(0.80);
    expect(AUDIO_VOLUME.slash).toBe(0.85);
  });

  it("guarantees every SFX is noticeably louder than gameplay BGM", () => {
    const sfxKeys = ["button", "place", "invalid", "lineClear", "combo", "boom", "gameOver", "slash"] as const;
    for (const key of sfxKeys) {
      expect(AUDIO_VOLUME[key]).toBeGreaterThan(AUDIO_VOLUME.gameBgm);
    }

    // Place / move SFX ratio is >= 3x BGM (0.70 vs 0.22, matching 02_2048 move ratio 0.70/0.25 = 2.8x)
    expect(AUDIO_VOLUME.place / AUDIO_VOLUME.gameBgm).toBeGreaterThanOrEqual(3.0);

    // Line clear / merge ratio is >= 3.5x BGM (0.85 vs 0.22, matching 02_2048 merge ratio 0.85/0.25 = 3.4x)
    expect(AUDIO_VOLUME.lineClear / AUDIO_VOLUME.gameBgm).toBeGreaterThanOrEqual(3.5);

    // Boom / bomb / celebration ratio is >= 4.0x BGM (0.90 vs 0.22)
    expect(AUDIO_VOLUME.boom / AUDIO_VOLUME.gameBgm).toBeGreaterThanOrEqual(4.0);

    // Button click is >= 2.0x landing BGM (0.65 vs 0.30) and >= 2.9x game BGM
    expect(AUDIO_VOLUME.button / AUDIO_VOLUME.landingBgm).toBeGreaterThanOrEqual(2.0);
    expect(AUDIO_VOLUME.button / AUDIO_VOLUME.gameBgm).toBeGreaterThanOrEqual(2.9);
  });

  it("exposes audioVolume through instance getter", () => {
    const audio = new BlockBlastAudio();
    expect(audio.audioVolume).toBe(AUDIO_VOLUME);
    expect(audio.gameBgmVolume).toBe(AUDIO_VOLUME.gameBgm);
    expect(audio.landingBgmVolume).toBe(AUDIO_VOLUME.landingBgm);
  });
});

