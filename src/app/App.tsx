import { useCallback, useEffect, useRef, useState } from "react";
import { CountrysideBackdrop } from "@/components/background/CountrysideBackdrop";
import { Game } from "@/features/blockblast/components/Game";
import { DashboardScreen } from "@/features/blockblast/screens/Dashboard";
import { SettingsScreen } from "@/features/blockblast/screens/Settings";
import { useScoreData } from "@/features/blockblast/hooks/useScoreData";
import { blockBlastAudio } from "@/features/blockblast/audio/blockBlastAudio";
import type { BoomEvent } from "@/features/blockblast/hooks/useBlockBlastGame";
import { useWinkIntegration } from "@/integrations/wink/useWinkIntegration";
import { useRoundFinalization } from "./useRoundFinalization";

type Screen = "game" | "dashboard" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("game");
  const [scenery, setScenery] = useState<"normal" | "boom">("normal");
  const sceneryTimerRef = useRef<number | null>(null);

  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [shakeEnabled, setShakeEnabled] = useState(true);

  // Wink bridge integration
  const wink = useWinkIntegration();
  const scoreData = useScoreData(wink.personalBest?.score ?? 0);
  const {
    submitError,
    onRoundStart,
    onGameEnd
  } = useRoundFinalization(wink);

  const isIframeDevError = import.meta.env.DEV && wink.error?.message?.toLowerCase().includes("iframe parent");
  const fatalWinkError = wink.phase === 'error' && !isIframeDevError ? wink.error : null;

  useEffect(() => {
    if (wink.hostPaused) {
      blockBlastAudio.suspend();
    } else {
      blockBlastAudio.resume();
    }
  }, [wink.hostPaused]);

  useEffect(() => {
    if (wink.phase === "ready_anonymous" || wink.phase === "ready_authenticated") {
      void wink.refreshLeaderboard();
    }
  }, [wink.phase, wink.refreshLeaderboard]);

  const applyMusicEnabled = useCallback(
    (requestedMusicEnabled: boolean, options?: { fromGesture?: boolean }) => {
      blockBlastAudio.setMusicEnabled(requestedMusicEnabled && !wink.parentMuted, options);
    },
    [wink.parentMuted]
  );

  // Apply parent mute to audio engine without touching user prefs
  useEffect(() => {
    applyMusicEnabled(musicEnabled);
  }, [musicEnabled, applyMusicEnabled]);

  useEffect(() => {
    blockBlastAudio.setSfxEnabled(sfxEnabled && !wink.parentMuted);
  }, [sfxEnabled, wink.parentMuted]);

  useEffect(() => {
    blockBlastAudio.preload();

    const unlockAudio = () => {
      blockBlastAudio.unlockFromGesture();
    };

    document.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
    document.addEventListener("touchstart", unlockAudio, { capture: true, passive: true });
    document.addEventListener("keydown", unlockAudio, { capture: true });

    return () => {
      document.removeEventListener("pointerdown", unlockAudio, { capture: true });
      document.removeEventListener("touchstart", unlockAudio, { capture: true });
      document.removeEventListener("keydown", unlockAudio, { capture: true });
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
      applyMusicEnabled(enabled, enabled && !wink.parentMuted ? { fromGesture: true } : undefined);
      setMusicEnabled(enabled);
    },
    [applyMusicEnabled, setMusicEnabled, wink.parentMuted]
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
            bestScore={scoreData.bestScore}
            stats={scoreData.stats}
            leaderboard={wink.leaderboard}
            onPlay={() => setScreen("game")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            musicEnabled={musicEnabled}
            sfxEnabled={sfxEnabled}
            shakeEnabled={shakeEnabled}
            onMusicChange={handleMusicChange}
            onSfxChange={setSfxEnabled}
            onShakeChange={setShakeEnabled}
            onBack={() => setScreen("game")}
          />
        )}

        {/* Keep Game mounted so we don't lose progress */}
        {(submitError || fatalWinkError) && (
          <div
            role="alert"
            style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 100, background: "rgba(180,30,30,0.92)", color: "#fff",
              padding: "8px 20px", borderRadius: 8, fontSize: 13, textAlign: "center",
            }}
          >
            {submitError || fatalWinkError?.message}
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
            sfxEnabled={sfxEnabled} 
            musicEnabled={musicEnabled}
            shakeEnabled={shakeEnabled}
            scenery={scenery}
            paused={screen !== "game" || wink.hostPaused}
            onBoom={handleBoom}
            onRoundStart={onRoundStart}
            onGameEnd={onGameEnd}
            onDashboard={() => setScreen("dashboard")} 
            onSettings={() => setScreen("settings")}
          />
        </div>
      </main>
    </div>
  );
}
