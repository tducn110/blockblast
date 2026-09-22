// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock loading utils
vi.mock("../utils/game-loader", () => ({
  preloadCriticalResources: vi.fn().mockResolvedValue(undefined),
  preloadNonCriticalResources: vi.fn(),
}));

vi.mock("../utils/loading-controller", () => ({
  setGameLoadingProgress: vi.fn(),
  completeGameLoading: vi.fn(),
  onGameLoadingDismiss: vi.fn((cb: () => void) => cb()),
}));

// Mock CountrysideBackdrop
vi.mock("@/components/background/CountrysideBackdrop", () => ({
  CountrysideBackdrop: () => <div data-testid="backdrop" />,
}));

// Mock audio
const mockPauseAll = vi.fn();
const mockResumeBgm = vi.fn();
const mockSetHostMuted = vi.fn();
const mockSetHostPaused = vi.fn();
const mockSetMusicEnabled = vi.fn();
const mockSetSfxEnabled = vi.fn();
const mockSetBgmVolume = vi.fn();
const mockPreload = vi.fn().mockResolvedValue(undefined);
const mockUnlockFromGesture = vi.fn().mockResolvedValue(true);

const mockDispose = vi.fn();

vi.mock("@/features/blockblast/audio/blockBlastAudio", () => ({
  blockBlastAudio: {
    pauseAll: (...args: unknown[]) => mockPauseAll(...args),
    resumeBgm: (...args: unknown[]) => mockResumeBgm(...args),
    setHostMuted: (...args: unknown[]) => mockSetHostMuted(...args),
    setHostPaused: (...args: unknown[]) => mockSetHostPaused(...args),
    setMusicEnabled: (...args: unknown[]) => mockSetMusicEnabled(...args),
    setSfxEnabled: (...args: unknown[]) => mockSetSfxEnabled(...args),
    setBgmVolume: (...args: unknown[]) => mockSetBgmVolume(...args),
    preload: (...args: unknown[]) => mockPreload(...args),
    unlockFromGesture: (...args: unknown[]) => mockUnlockFromGesture(...args),
    dispose: (...args: unknown[]) => mockDispose(...args),
    playButtonClick: vi.fn(),
  },
  LANDING_BGM_VOLUME: 0.3,
  GAME_BGM_VOLUME: 0.22,
}));

let latestGameProps: Record<string, unknown> = {};
vi.mock("@/features/blockblast/components/Game", () => ({
  Game: (props: Record<string, unknown>) => {
    latestGameProps = props;
    return <div data-testid="game-component" data-paused={String(props.paused)} />;
  },
}));

let mockHostPaused = false;
let mockParentMuted = false;
vi.mock("@/integrations/wink/useWinkIntegration", () => ({
  useWinkIntegration: () => ({
    status: "standalone",
    parentMuted: mockParentMuted,
    hostPaused: mockHostPaused,
    bestScore: 0,
    leaderboard: [],
    playerEntry: null,
    gameplayStart: vi.fn(),
    gameplayStop: vi.fn(),
    submitScore: vi.fn(),
    can: () => true,
    refreshLeaderboard: vi.fn(),
  }),
  resolveGlobalWink: () => null,
}));

import App from "./App";

describe("App lifecycle, focus loss & settings pause routing", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHostPaused = false;
    mockParentMuted = false;
    latestGameProps = {};
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderApp() {
    act(() => {
      root.render(<App />);
    });
  }

  it("renders on game screen by default and passes unlockAudio to Game", () => {
    renderApp();

    expect(container.querySelector(".blockblast-game-mount")).not.toBeNull();
    expect(typeof latestGameProps.unlockAudio).toBe("function");

    // Calling unlockAudio invokes blockBlastAudio.unlockFromGesture
    act(() => {
      (latestGameProps.unlockAudio as () => void)();
    });
    expect(mockUnlockFromGesture).toHaveBeenCalled();
  });

  it("switches to settings screen and calls pauseAll on window blur", () => {
    renderApp();

    expect(container.querySelector(".blockblast-game-mount")?.getAttribute("style")).not.toContain("display: none");

    // Trigger blur event
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    // 1. Audio must be paused
    expect(mockPauseAll).toHaveBeenCalled();

    // 2. Settings screen must now be visible
    expect(container.textContent?.toLowerCase()).toContain("settings");

    // 3. Game mount must now be hidden and paused
    expect(latestGameProps.paused).toBe(true);
  });

  it("switches to settings screen and calls pauseAll on visibility hidden", () => {
    renderApp();

    // Mock document.visibilityState = "hidden"
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockPauseAll).toHaveBeenCalled();
    expect(container.textContent?.toLowerCase()).toContain("settings");
    expect(latestGameProps.paused).toBe(true);
  });

  it("returns to game and unpauses when player clicks BACK on Settings", () => {
    renderApp();

    // Lose focus -> switches to settings
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(container.textContent?.toLowerCase()).toContain("settings");

    // Regain focus
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    // Find and click the BACK button in Settings
    const buttons = Array.from(container.querySelectorAll("button"));
    const backButton = buttons.find((btn) => btn.textContent?.toLowerCase().includes("back") || btn.textContent?.toLowerCase().includes("quay lại"));
    expect(backButton).toBeDefined();

    act(() => {
      backButton?.click();
    });

    // Returned to game
    expect(latestGameProps.paused).toBe(false);
  });
});
