import { useState } from "react";
import { CountrysideBackdrop } from "../components/background/CountrysideBackdrop";
import { Game } from "../components/game/Game";
import { DashboardScreen } from "../components/screens/Dashboard";
import { SettingsScreen } from "../components/screens/Settings";
import { useScoreData } from "../hooks/useScoreData";

type Screen = "game" | "dashboard" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("game");
  const scoreData = useScoreData();

  // Settings state can be stored in localStorage eventually, just local state for now
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100vw",
        overflowX: "hidden",
        overflowY: "auto",
        background: "#f5ecd7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      <CountrysideBackdrop />

      <main
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: screen === "dashboard" ? 520 : (screen === "settings" ? 460 : 860),
          minHeight: "100dvh",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
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
        <div style={{ display: screen === "game" ? "block" : "none", width: "100%" }}>
          <Game 
            scoreData={scoreData} 
            sfxEnabled={sfxEnabled} 
            onDashboard={() => setScreen("dashboard")} 
            onSettings={() => setScreen("settings")}
          />
        </div>
      </main>
    </div>
  );
}
