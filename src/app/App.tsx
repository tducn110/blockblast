import { CountrysideBackdrop } from "../components/background/CountrysideBackdrop";
import { Game } from "../components/game/Game";

export default function App() {
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
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}
    >
      <CountrysideBackdrop />
      <main
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          minHeight: "100dvh",
          padding: "16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Game />
      </main>
    </div>
  );
}
