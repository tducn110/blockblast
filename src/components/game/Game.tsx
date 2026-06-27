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
import { GAME_TEXT } from "../../constants/gameText";

export function Game() {
  const scoreData = useScoreData();
  const game = useBlockBlastGame({
    bestScore: scoreData.bestScore,
    onGameOver: scoreData.handleGameOver,
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const piecesLeft = game.pieces.filter((piece) => !piece.placed).length;

  return (
    <section className="w-full max-w-[440px] lg:max-w-[860px] mx-auto bg-[#fdf6ea]/96 border-2 border-[#8a7d65]/34 rounded-[28px] p-[14px_14px_18px] lg:p-[28px] shadow-[0_18px_46px_rgba(42,36,24,0.18)] flex flex-col lg:flex-row gap-[12px] lg:gap-[32px] relative font-['Be_Vietnam_Pro',sans-serif] overflow-hidden">
      
      {/* Left Column: UI Controls (Header, HUD, Instructions) */}
      <div className="flex flex-col gap-[12px] lg:gap-[24px] lg:w-[280px] lg:shrink-0 lg:py-[12px]">
        {/* Header Row (Mobile) / Stack (PC) */}
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-6">
          <div className="flex items-center gap-2 min-w-0">
            <LogoBubble size={34} />
            <div className="min-w-0">
              <div className="text-[15px] lg:text-[20px] font-black text-[#2a2418] leading-[1.05]">
                {GAME_TEXT.TITLE}
              </div>
              <div className="text-[9px] lg:text-[11px] font-extrabold text-[#8a7d65] tracking-[0.5px] mt-0.5">
                {GAME_TEXT.SUBTITLE}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:gap-3">
            <IconButton label={GAME_TEXT.TOOLTIP_LEADERBOARD} onClick={() => setShowLeaderboard(true)}>
              <Trophy size={16} />
            </IconButton>
            <IconButton label={game.sfxEnabled ? GAME_TEXT.TOOLTIP_SOUND_ON : GAME_TEXT.TOOLTIP_SOUND_OFF} onClick={game.toggleSfx}>
              {game.sfxEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconButton>
            <IconButton label={GAME_TEXT.TOOLTIP_PLAY_AGAIN} onClick={game.resetGame}>
              <RotateCcw size={16} />
            </IconButton>
          </div>
        </div>

        {/* HUD row (Mobile) / Stack (PC) */}
        <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-6 lg:mt-6">
          <Mascot size={46} />
          <div className="flex-1 min-w-0 lg:w-full">
            <GameHUD
              score={game.score}
              bestScore={game.bestScore}
              combo={game.combo}
              piecesLeft={piecesLeft}
            />
          </div>
        </div>

        <div className="lg:mt-auto flex flex-col gap-2">
          <p className="text-[11px] lg:text-[13px] text-[#8a7d65] text-center lg:text-left m-0">
            {GAME_TEXT.INSTRUCTION}
          </p>
          
          {scoreData.saveError && (
            <p className="m-0 text-[#b85a22] text-[11px] lg:text-[13px] font-bold text-center lg:text-left">
              {scoreData.saveError}
            </p>
          )}
        </div>
      </div>

      {/* Right Column: Canvas Board */}
      <div className="relative flex-1 flex flex-col items-center justify-center">
        <div className="w-full relative max-w-[500px]">
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
            <div className="absolute inset-0 bg-[#2a2418]/80 rounded-[22px] flex flex-col items-center justify-center gap-[12px] z-20 animate-[fadeScaleIn_0.32s_ease]">
              <div className="text-[26px] font-black text-[#f0b840]">{GAME_TEXT.GAME_OVER_TITLE}</div>
              <div className="text-[15px] text-[#efe3c4]">
                {GAME_TEXT.RESULT} <strong>{game.score.toLocaleString()}</strong> {GAME_TEXT.POINTS}
              </div>
              <div className="flex gap-2">
                <Button onClick={game.resetGame} size="sm">
                  {GAME_TEXT.BTN_PLAY_AGAIN}
                </Button>
                <Button variant="ghost" onClick={() => setShowLeaderboard(true)} size="sm">
                  {GAME_TEXT.BTN_LEADERBOARD}
                </Button>
              </div>
            </div>
          )}
        </div>
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
