import { useEffect, useRef } from "react";
import { Trophy, RotateCcw, Settings } from "lucide-react";
import { useBlockBlastGame, type BoomEvent } from "@/features/blockblast/hooks/useBlockBlastGame";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { LogoBubble } from "@/components/ui/LogoBubble";
import { GameHUD } from "@/features/blockblast/components/GameHUD";
import { Mascot } from "@/features/blockblast/components/Mascot";
import { PixiBlockBlastCanvas } from "@/features/blockblast/components/PixiBlockBlastCanvas";
import { SlashScoreOverlay } from "@/features/blockblast/components/SlashScoreOverlay";
import { GAME_TEXT } from "@/features/blockblast/lib/gameText";
import type { ScoreData } from "@/features/blockblast/hooks/useScoreData";

interface GameProps {
  scoreData: ScoreData;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  scenery: "normal" | "boom";
  onBoom: (event: BoomEvent) => void;
  onDashboard: () => void;
  onSettings: () => void;
}

export function Game({
  scoreData,
  sfxEnabled,
  musicEnabled,
  scenery,
  onBoom,
  onDashboard,
  onSettings,
}: GameProps) {
  const game = useBlockBlastGame({
    bestScore: scoreData.bestScore,
    onGameOver: scoreData.handleGameOver,
    sfxEnabled,
    musicEnabled,
  });
  const lastBoomEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game.boomEvent || lastBoomEventIdRef.current === game.boomEvent.id) return;
    lastBoomEventIdRef.current = game.boomEvent.id;
    onBoom(game.boomEvent);
  }, [game.boomEvent, onBoom]);
  
  const mascotMood =
    scenery === "boom" ? "boom" : game.status === "gameOver" ? "gameOver" : "idle";
  const mascotVariantIndex = scenery === "boom" ? 2 : 0;

  return (
    <section
      className="w-full max-w-[440px] lg:max-w-[860px] mx-auto bg-[#fdf6ea]/96 border-2 border-[#8a7d65]/34 rounded-[28px] p-[14px_14px_18px] lg:p-[28px] shadow-[0_18px_46px_rgba(42,36,24,0.18)] flex flex-col lg:flex-row gap-[12px] lg:gap-[32px] relative font-['Be_Vietnam_Pro',sans-serif] overflow-hidden"
      style={{
        boxShadow:
          scenery === "boom"
            ? "0 22px 58px rgba(184,90,34,0.28), 0 0 0 2px rgba(240,184,64,0.42) inset"
            : undefined,
      }}
    >
      
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

          <div className="flex items-center gap-2 lg:gap-3">
            <IconButton label={GAME_TEXT.TOOLTIP_LEADERBOARD} onClick={onDashboard} size={40}>
              <Trophy size={20} />
            </IconButton>
            <IconButton label="Cài đặt" onClick={onSettings} size={40}>
              <Settings size={22} />
            </IconButton>
            <IconButton label={GAME_TEXT.TOOLTIP_PLAY_AGAIN} onClick={game.resetGame} size={40}>
              <RotateCcw size={20} />
            </IconButton>
          </div>
        </div>

        {/* HUD row (Mobile) / Stack (PC) */}
        <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-6 lg:mt-6">
          <Mascot size={64} variantIndex={mascotVariantIndex} mood={mascotMood} />
          <div className="flex-1 min-w-0 lg:w-full">
            <GameHUD
              score={game.score}
              bestScore={game.bestScore}
              feedback={game.feedback}
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

          <SlashScoreOverlay items={game.feedback} />

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
                <Button variant="ghost" onClick={onDashboard} size="sm">
                  {GAME_TEXT.BTN_LEADERBOARD}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
