import { useState } from "react";
import { RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { useBlockBlastGame } from "../../hooks/useBlockBlastGame";
import { useScoreData } from "../../hooks/useScoreData";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { LogoBubble } from "../ui/LogoBubble";
import { GameHUD } from "./GameHUD";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { Mascot } from "./Mascot";
import { PixiBlockBlastCanvas } from "./PixiBlockBlastCanvas";

export function Game() {
  const scoreData = useScoreData();
  const game = useBlockBlastGame({
    bestScore: scoreData.bestScore,
    onGameOver: scoreData.handleGameOver,
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const piecesLeft = game.pieces.filter((piece) => !piece.placed).length;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 410,
        margin: "0 auto",
        background: "rgba(253,246,234,0.96)",
        border: "2px solid rgba(138,125,101,0.34)",
        borderRadius: 28,
        padding: "14px 14px 18px",
        boxShadow: "0 18px 46px rgba(42,36,24,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        overflow: "hidden",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <LogoBubble size={34} />
          <div className="min-w-0">
            <div style={{ fontSize: 15, fontWeight: 900, color: "#2a2418", lineHeight: 1.05 }}>
              Xếp Khối
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#8a7d65", letterSpacing: 0.5 }}>
              BỘ LẠC ĐẬU PHỘNG
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="Bảng điểm" onClick={() => setShowLeaderboard(true)}>
            <Trophy size={16} />
          </IconButton>
          <IconButton label={game.sfxEnabled ? "Tắt âm thanh" : "Bật âm thanh"} onClick={game.toggleSfx}>
            {game.sfxEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </IconButton>
          <IconButton label="Chơi lại" onClick={game.resetGame}>
            <RotateCcw size={16} />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Mascot size={46} />
        <div className="flex-1 min-w-0">
          <GameHUD
            score={game.score}
            bestScore={game.bestScore}
            combo={game.combo}
            piecesLeft={piecesLeft}
          />
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#8a7d65", textAlign: "center", margin: 0 }}>
        Kéo khối vào bảng, lấp đầy hàng hoặc cột để dọn ô
      </p>

      {scoreData.saveError && (
        <p
          style={{
            margin: "-4px 0 0",
            color: "#b85a22",
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {scoreData.saveError}
        </p>
      )}

      <div style={{ position: "relative" }}>
        <PixiBlockBlastCanvas
          board={game.board}
          pieces={game.pieces}
          selectedPieceId={game.selectedPieceId}
          status={game.status}
          clearAnimation={game.clearAnimation}
          placementAnimation={game.placementAnimation}
          onSelectPiece={game.selectPiece}
          onPlacePiece={game.placePiece}
        />

        {game.status === "gameOver" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(42,36,24,0.82)",
              borderRadius: 22,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              animation: "fadeScaleIn 0.32s ease",
              zIndex: 20,
            }}
          >
            <style>{`
              @keyframes fadeScaleIn {
                from { opacity: 0; transform: scale(0.96); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#f0b840" }}>Hết chỗ rồi!</div>
            <div style={{ fontSize: 15, color: "#efe3c4" }}>
              Kết quả: <strong>{game.score.toLocaleString()}</strong> điểm
            </div>
            <div className="flex gap-2">
              <Button onClick={game.resetGame} size="sm">
                Chơi lại
              </Button>
              <Button variant="ghost" onClick={() => setShowLeaderboard(true)} size="sm">
                Bảng điểm
              </Button>
            </div>
          </div>
        )}
      </div>

      {showLeaderboard && (
        <LeaderboardPanel
          stats={scoreData.stats}
          maxCombo={game.maxCombo}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </section>
  );
}
