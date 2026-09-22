import { useCallback, useEffect, useRef, useState } from "react";
import { CountrysideBackdrop } from "@/components/background/CountrysideBackdrop";
import { Game } from "@/features/blockblast/components/Game";
import { DashboardScreen } from "@/features/blockblast/screens/Dashboard";
import { SettingsScreen } from "@/features/blockblast/screens/Settings";
import { useScoreData } from "@/features/blockblast/hooks/useScoreData";
import { blockBlastAudio, LANDING_BGM_VOLUME, GAME_BGM_VOLUME } from "@/features/blockblast/audio/blockBlastAudio";
import type { BoomEvent } from "@/features/blockblast/hooks/useBlockBlastGame";
import { useWinkIntegration, resolveGlobalWink } from "@/integrations/wink/useWinkIntegration";
import { preloadCriticalResources, preloadNonCriticalResources } from "../utils/game-loader";
import { completeGameLoading, onGameLoadingDismiss, setGameLoadingProgress } from "../utils/loading-controller";


type Screen = "game" | "dashboard" | "settings";

export default function App() {
  useEffect(() => {
    const blockCopyAction = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener("copy", blockCopyAction, true);
    document.addEventListener("cut", blockCopyAction, true);
    document.addEventListener("selectstart", blockCopyAction, true);
    document.addEventListener("dragstart", blockCopyAction, true);
    document.addEventListener("contextmenu", blockCopyAction, true);

    return () => {
      document.removeEventListener("copy", blockCopyAction, true);
      document.removeEventListener("cut", blockCopyAction, true);
      document.removeEventListener("selectstart", blockCopyAction, true);
      document.removeEventListener("dragstart", blockCopyAction, true);
      document.removeEventListener("contextmenu", blockCopyAction, true);
    };
  }, []);

  // Unified PapaStudio loading screen lifecycle barrier
  useEffect(() => {
    setGameLoadingProgress(20);
    const criticalPromise = preloadCriticalResources((pct) => {
      setGameLoadingProgress(Math.min(95, pct));
    });
    const winkPromise = resolveGlobalWink();
    void Promise.allSettled([criticalPromise, winkPromise]).then(() => {
      completeGameLoading();
    });
    const unbind = onGameLoadingDismiss(() => {
      preloadNonCriticalResources();
    });
    return unbind;
  }, []);

  // Fallback: unlock audio on first user interaction if autoplay was blocked by browser
  useEffect(() => {
    const handleFirstInteraction = () => {
      void blockBlastAudio.unlockFromGesture({ removeFallbackListeners: true }).catch(() => {});
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("touchstart", handleFirstInteraction, true);
      window.removeEventListener("touchend", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, { capture: true, passive: true });
    window.addEventListener("touchstart", handleFirstInteraction, { capture: true, passive: true });
    window.addEventListener("touchend", handleFirstInteraction, { capture: true, passive: true });
    window.addEventListener("keydown", handleFirstInteraction, { capture: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("touchstart", handleFirstInteraction, true);
      window.removeEventListener("touchend", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };
  }, []);

  const wink = useWinkIntegration();
  const [screen, setScreen] = useState<Screen>("game");
  const [scenery, setScenery] = useState<"normal" | "boom">("normal");
  const sceneryTimerRef = useRef<number | null>(null);

  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const scoreData = useScoreData(wink.bestScore);
  const submitError = null;

  useEffect(() => {
    if (screen !== "dashboard" || wink.status === "standalone") return;
    void wink.refreshLeaderboard().catch(() => {});
  }, [screen, wink.refreshLeaderboard, wink.status]);

  const openDashboard = useCallback(() => {
    setScreen("dashboard");
  }, []);

  // Sync host mute and pause controls directly from Wink SDK
  useEffect(() => {
    blockBlastAudio.setHostMuted(wink.parentMuted);
    blockBlastAudio.setHostPaused(wink.hostPaused);
  }, [wink.parentMuted, wink.hostPaused]);

  useEffect(() => {
    blockBlastAudio.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  useEffect(() => {
    blockBlastAudio.setSfxEnabled(sfxEnabled);
  }, [sfxEnabled]);

  // Screen volume boundary matching 01_fruit and 03_muavu standard
  useEffect(() => {
    if (screen === "game") {
      blockBlastAudio.setBgmVolume(GAME_BGM_VOLUME);
    } else {
      blockBlastAudio.setBgmVolume(LANDING_BGM_VOLUME);
    }
  }, [screen]);

  // ponytail: lifecycle control matching 01_fruit & 03_muavu standard: pause game & audio on blur/hidden, resume on focus/visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setIsWindowFocused(false);
        blockBlastAudio.pauseAll();
      } else if (!document.hidden && (!document.hasFocus || document.hasFocus())) {
        setIsWindowFocused(true);
        if (!wink.hostPaused && !wink.parentMuted) {
          blockBlastAudio.resumeBgm();
        }
      }
    };
    const handleBlur = () => {
      setIsWindowFocused(false);
      blockBlastAudio.pauseAll();
    };
    const handleFocus = () => {
      if (!document.hidden) {
        setIsWindowFocused(true);
        if (!wink.hostPaused && !wink.parentMuted) {
          blockBlastAudio.resumeBgm();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [wink.hostPaused, wink.parentMuted]);

  useEffect(() => {
    void blockBlastAudio.preload();

    return () => {
      blockBlastAudio.dispose();
    };
  }, []);

  const handleBoom = useCallback((_event: BoomEvent) => {
    if (!shakeEnabled) return;
    if (sceneryTimerRef.current !== null) {
      window.clearTimeout(sceneryTimerRef.current);
    }

    setScenery("boom");
    sceneryTimerRef.current = window.setTimeout(() => {
      setScenery("normal");
      sceneryTimerRef.current = null;
    }, 4200);
  }, [shakeEnabled]);

  useEffect(
    () => () => {
      if (sceneryTimerRef.current !== null) window.clearTimeout(sceneryTimerRef.current);
    },
    []
  );

  const handleMusicChange = useCallback(
    (enabled: boolean) => {
      setMusicEnabled(enabled);
      blockBlastAudio.setMusicEnabled(enabled, { fromGesture: true });
    },
    [setMusicEnabled]
  );

  const handleSfxChange = useCallback(
    (enabled: boolean) => {
      setSfxEnabled(enabled);
      blockBlastAudio.setSfxEnabled(enabled);
    },
    [setSfxEnabled]
  );

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "#f5ecd7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxSizing: "border-box",
      }}
    >
      <CountrysideBackdrop scenery={scenery} />

      <main
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: screen === "dashboard" ? 520 : (screen === "settings" ? 460 : 1080),
          height: "100%",
          minHeight: 0,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          overflowY: "hidden",
          overscrollBehavior: "none",
        }}
      >
        {screen === "dashboard" && (
          <DashboardScreen 
            bestScore={wink.status === "standalone" ? scoreData.bestScore : wink.bestScore}
            stats={scoreData.stats}
            leaderboard={wink.leaderboard}
            player={wink.playerEntry}
            standalone={wink.status === "standalone"}
            onPlay={() => setScreen("game")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            musicEnabled={musicEnabled}
            sfxEnabled={sfxEnabled}
            shakeEnabled={shakeEnabled}
            onMusicChange={handleMusicChange}
            onSfxChange={handleSfxChange}
            onShakeChange={setShakeEnabled}
            onBack={() => setScreen("game")}
          />
        )}

        {/* Keep Game mounted so we don't lose progress */}
        {submitError && (
          <div
            role="alert"
            style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 100, background: "rgba(180,30,30,0.92)", color: "#fff",
              padding: "8px 20px", borderRadius: 8, fontSize: 13, textAlign: "center",
            }}
          >
            {submitError}
          </div>
        )}
        <div
          className="blockblast-game-mount"
          style={{
            display: screen === "game" ? undefined : "none",
            width: "100%",
            height: "100%",
            minHeight: 0,
          }}
        >
          <Game
            scoreData={scoreData} 
            sfxEnabled={sfxEnabled && !wink.parentMuted} 
            musicEnabled={musicEnabled && !wink.parentMuted}
            shakeEnabled={shakeEnabled}
            scenery={scenery}
            paused={screen !== "game" || wink.hostPaused || !isWindowFocused}
            onBoom={handleBoom}
            onRoundStart={wink.gameplayStart}
            onGameEnd={async (finalScore) => {
              wink.gameplayStop();
              if (wink.can("submitScore")) {
                try {
                  await wink.submitFinalScore({ score: finalScore });
                  await wink.refreshLeaderboard();
                } catch (e) {
                  console.warn("[Wink] submitScore error", e);
                }
              }
            }}
            onDashboard={openDashboard}
            onSettings={() => setScreen("settings")}
          />
        </div>
      </main>
    </div>
  );
}
