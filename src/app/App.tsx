import { useCallback, useEffect, useRef, useState } from "react";
import { CountrysideBackdrop } from "@/components/background/CountrysideBackdrop";
import { Game } from "@/features/blockblast/components/Game";
import { DashboardScreen } from "@/features/blockblast/screens/Dashboard";
import { SettingsScreen } from "@/features/blockblast/screens/Settings";
import { useScoreData } from "@/features/blockblast/hooks/useScoreData";
import type { BoomEvent } from "@/features/blockblast/hooks/useBlockBlastGame";

type Screen = "game" | "dashboard" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("game");
  const scoreData = useScoreData();
  const [scenery, setScenery] = useState<"normal" | "boom">("normal");
  const sceneryTimerRef = useRef<number | null>(null);

  // Settings state can be stored in localStorage eventually, just local state for now
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const handleBoom = useCallback((_event: BoomEvent) => {
    if (sceneryTimerRef.current !== null) {
      window.clearTimeout(sceneryTimerRef.current);
    }

    setScenery("boom");
    sceneryTimerRef.current = window.setTimeout(() => {
      setScenery("normal");
      sceneryTimerRef.current = null;
    }, 4200);
  }, []);

  useEffect(
    () => () => {
      if (sceneryTimerRef.current !== null) window.clearTimeout(sceneryTimerRef.current);
    },
    []
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
          maxWidth: screen === "dashboard" ? 520 : (screen === "settings" ? 460 : 860),
          height: "100%",
          minHeight: 0,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          overflowY: screen === "game" ? "hidden" : "auto",
          overscrollBehavior: "none",
        }}
      >
        {screen === "dashboard" && (
          <DashboardScreen 
            bestScore={scoreData.bestScore}
            stats={scoreData.stats}
            onPlay={() => setScreen("game")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            musicEnabled={musicEnabled}
            sfxEnabled={sfxEnabled}
            onMusicChange={setMusicEnabled}
            onSfxChange={setSfxEnabled}
            onBack={() => setScreen("game")}
          />
        )}

        {/* Keep Game mounted so we don't lose progress */}
        <div
          style={{
            display: screen === "game" ? "block" : "none",
            width: "100%",
            height: "100%",
            minHeight: 0,
          }}
        >
          <Game 
            scoreData={scoreData} 
            sfxEnabled={sfxEnabled} 
            musicEnabled={musicEnabled}
            scenery={scenery}
            paused={screen !== "game"}
            onBoom={handleBoom}
            onDashboard={() => setScreen("dashboard")} 
            onSettings={() => setScreen("settings")}
          />
        </div>
      </main>
    </div>
  );
}
