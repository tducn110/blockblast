// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockBlastAudio } from "./blockBlastAudio";

type MockAudioElement = HTMLAudioElement & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
};

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("BlockBlastAudio music lifecycle", () => {
  let audioCtor: ReturnType<typeof vi.fn>;
  let createdAudio: MockAudioElement[];
  let failNextMusicPlay: boolean;
  let fakeContext: {
    state: "suspended" | "running";
    destination: object;
    resume: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    createMediaElementSource: ReturnType<typeof vi.fn>;
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
        load: vi.fn(),
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
      resume: vi.fn().mockImplementation(async () => {
        fakeContext.state = "running";
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
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
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

    audio.unlockFromGesture();
    await flushMicrotasks();

    expect(musicElement.play).toHaveBeenCalledTimes(2);
  });

  it("starts music from the enabling gesture and keeps a single active instance", async () => {
    const audio = new BlockBlastAudio();

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    const musicElement = createdAudio[0];
    expect(fakeContext.resume).toHaveBeenCalledTimes(1);
    expect(musicElement.play).toHaveBeenCalledTimes(1);

    audio.setMusicEnabled(true, { fromGesture: true });
    await flushMicrotasks();

    expect(musicElement.play).toHaveBeenCalledTimes(1);
    expect(fakeContext.createMediaElementSource).toHaveBeenCalledTimes(1);
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
});
