import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  BLOCK_BORDER_MAP,
  BLOCK_COLOR_MAP,
  type BlockPiece,
} from "@/features/blockblast/game/blockBlastLogic";

interface GameProps {
  scoreData: ScoreData;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  scenery: "normal" | "boom";
  paused: boolean;
  onBoom: (event: BoomEvent) => void;
  onDashboard: () => void;
  onSettings: () => void;
}

export function Game({
  scoreData,
  sfxEnabled,
  musicEnabled,
  scenery,
  paused,
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
  const adReplayTimerRef = useRef<number | null>(null);
  const [adReplayStatus, setAdReplayStatus] = useState<"idle" | "loading" | "clearing">("idle");
  const [isReserveAdLoading, setIsReserveAdLoading] = useState(false);

  useEffect(() => {
    if (!game.boomEvent || lastBoomEventIdRef.current === game.boomEvent.id) return;
    lastBoomEventIdRef.current = game.boomEvent.id;
    onBoom(game.boomEvent);
  }, [game.boomEvent, onBoom]);

  useEffect(
    () => () => {
      if (adReplayTimerRef.current !== null) window.clearTimeout(adReplayTimerRef.current);
    },
    []
  );

  const mascotMood =
    scenery === "boom" ? "boom" : game.status === "gameOver" ? "gameOver" : "idle";
  const mascotVariantIndex = scenery === "boom" ? 2 : 0;
  const showMobileReserveSlot = useIsMobileReserveTray();
  const reserveStoreLabel =
    game.selectedPieceId === game.reservePiece?.id
      ? "Bỏ chọn"
      : game.selectedPieceId && game.reservePiece
        ? "Đổi khối"
        : game.selectedPieceId
          ? "Cất khối"
        : game.reservePiece
          ? "Lấy ra"
          : "Cất khối";
  const reserveStoreDisabled =
    game.status !== "playing" ||
    !game.reserveUnlocked ||
    (!game.selectedPieceId && !game.reservePiece);
  const adActionDisabled = game.status !== "playing" || game.reserveUnlocked || isReserveAdLoading;
  const handleUnlockReserve = useCallback(async () => {
    if (adActionDisabled) return;

    setIsReserveAdLoading(true);
    const reward = await playMockAd();
    setIsReserveAdLoading(false);

    if (reward.granted) {
      game.unlockReserveSlot();
    }
  }, [adActionDisabled, game.unlockReserveSlot]);
  const handleReserveAction = () => {
    game.useReserveSlot();
  };
  const handleAdReplay = useCallback(async () => {
    if (adReplayStatus !== "idle") return;

    setAdReplayStatus("loading");
    const reward = await playMockAd();

    if (!reward.granted) {
      setAdReplayStatus("idle");
      return;
    }

    setAdReplayStatus("clearing");
    const hasClearAnimation = game.clearBoardForReplay();
    adReplayTimerRef.current = window.setTimeout(() => {
      adReplayTimerRef.current = null;
      setAdReplayStatus("idle");
      game.continueAfterReplay();
    }, hasClearAnimation ? 780 : 120);
  }, [adReplayStatus, game.clearBoardForReplay, game.continueAfterReplay]);

  return (
    <section
      className="w-full max-w-[440px] lg:max-w-[1080px] mx-auto bg-[#fdf6ea]/96 border-2 border-[#8a7d65]/34 rounded-[28px] p-[14px_14px_18px] lg:p-[30px] shadow-[0_18px_46px_rgba(42,36,24,0.18)] flex flex-col lg:flex-row gap-[12px] lg:gap-[38px] relative font-['Be_Vietnam_Pro',sans-serif] overflow-hidden"
      style={{
        boxShadow:
          scenery === "boom"
            ? "0 22px 58px rgba(184,90,34,0.28), 0 0 0 2px rgba(240,184,64,0.42) inset"
            : undefined,
      }}
    >
      
      {/* Left Column: UI Controls (Header, HUD, Instructions) */}
      <div className="flex flex-col gap-[12px] lg:gap-[18px] lg:w-[340px] lg:shrink-0 lg:py-[8px]">
        {/* Header Row (Mobile) / Stack (PC) */}
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-4">
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

        <div className="flex flex-col gap-[10px] lg:gap-[14px] lg:rounded-[24px] lg:border lg:border-[#8a7d65]/18 lg:bg-[#efe3c4]/38 lg:p-[16px] lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          {/* HUD row */}
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="lg:hidden">
              <Mascot size={64} variantIndex={mascotVariantIndex} mood={mascotMood} />
            </div>
            <div className="flex-1 min-w-0">
              <GameHUD
                score={game.score}
                bestScore={game.bestScore}
                feedback={game.feedback}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] lg:text-[12px] text-[#8a7d65] text-center lg:text-left m-0 lg:leading-[1.45]">
              {GAME_TEXT.INSTRUCTION}
            </p>

            {scoreData.saveError && (
              <p className="m-0 text-[#b85a22] text-[11px] lg:text-[13px] font-bold text-center lg:text-left">
                {scoreData.saveError}
              </p>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-[14px] rounded-[26px] border border-[#8a7d65]/16 bg-[#fffaf0]/86 p-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-[16px]">
            <div className="grid place-items-center">
              <Mascot size={112} variantIndex={mascotVariantIndex} mood={mascotMood} />
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-[10px] rounded-[20px] border border-[#f0b840]/22 bg-[#f5ecd7]/64 p-[14px]">
              <div>
                <div className="text-[13px] font-black uppercase tracking-[0.8px] text-[#8e4e22]">
                  Mock ads
                </div>
                <div className="mt-[2px] text-[12px] font-bold leading-[1.4] text-[#8a7d65]">
                  {game.reserveUnlocked
                    ? "Kho phụ đã mở. Chọn khối rồi cất bên dưới."
                    : "Xem mock ads để mở thêm 1 ô cất khối."}
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                disabled={adActionDisabled}
                onClick={handleUnlockReserve}
                style={{ alignSelf: "flex-start", minWidth: 132, minHeight: 38, paddingLeft: 14, paddingRight: 14 }}
              >
                {isReserveAdLoading ? GAME_TEXT.BTN_AD_LOADING : game.reserveUnlocked ? "Đã mở kho" : "Xem mock ads"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-[14px] rounded-[20px] border border-[#8a7d65]/16 bg-[#fdf6ea]/78 p-[12px]">
            <div className="flex items-center gap-[12px]">
              <ReservePiecePreview piece={game.reserveUnlocked ? game.reservePiece : null} />
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.7px] text-[#8e4e22]">
                  Ô cất khối
                </div>
                <div className="text-[11px] font-bold leading-[1.35] text-[#8a7d65]">
                  Chọn khối ở khay rồi cất vào đây.
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={reserveStoreDisabled}
              onClick={handleReserveAction}
              style={{ minWidth: 104, minHeight: 38, paddingLeft: 12, paddingRight: 12 }}
            >
              {reserveStoreLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column: Canvas Board */}
      <div className="relative flex-1 flex flex-col items-center justify-center">
        <div className="w-full relative max-w-[590px]">
          <PixiBlockBlastCanvas
            board={game.board}
            pieces={game.pieces}
            selectedPieceId={game.selectedPieceId}
            reserveUnlocked={game.reserveUnlocked}
            reservePiece={game.reservePiece}
            showMobileReserveSlot={showMobileReserveSlot}
            status={game.status}
            clearAnimation={game.clearAnimation}
            placementAnimation={game.placementAnimation}
            comboShakeEvent={game.comboShakeEvent}
            paused={paused}
            onSelectPiece={game.selectPiece}
            onPlacePiece={game.placePiece}
            onUnlockReserve={handleUnlockReserve}
            onUseReserveSlot={game.useReserveSlot}
          />

          <SlashScoreOverlay items={game.feedback} />

          {game.status === "gameOver" && (
            <div className="absolute inset-0 bg-[#2a2418]/82 rounded-[22px] flex flex-col items-center justify-center gap-[12px] z-20 px-[18px] text-center animate-[fadeScaleIn_0.32s_ease]">
              <div className="text-[26px] font-black text-[#f0b840]">{GAME_TEXT.GAME_OVER_TITLE}</div>
              <div className="text-[15px] text-[#efe3c4]">
                {GAME_TEXT.RESULT} <strong>{game.score.toLocaleString()}</strong> {GAME_TEXT.POINTS}
              </div>
              <div className="w-full max-w-[270px] rounded-[20px] border border-[#f0b840]/35 bg-[#fff3cf]/12 p-[10px] shadow-[0_10px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.12)]">
                <div className="text-[11px] font-black uppercase tracking-[0.7px] text-[#f7d77c]">
                  {GAME_TEXT.AD_REPLAY_LABEL}
                </div>
                <div className="mt-[3px] text-[11px] font-bold leading-[1.35] text-[#efe3c4]/86">
                  {GAME_TEXT.AD_REPLAY_HINT}
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={adReplayStatus !== "idle"}
                  onClick={handleAdReplay}
                  style={{
                    width: "100%",
                    minHeight: 52,
                    marginTop: 10,
                    paddingLeft: 18,
                    paddingRight: 18,
                    fontSize: 14,
                    boxShadow:
                      "0 12px 24px rgba(240,184,64,0.34), inset 0 1px 0 rgba(255,255,255,0.46)",
                  }}
                >
                  {adReplayStatus === "loading"
                    ? GAME_TEXT.BTN_AD_LOADING
                    : adReplayStatus === "clearing"
                      ? GAME_TEXT.BTN_AD_CLEARING
                      : GAME_TEXT.BTN_AD_REPLAY}
                </Button>
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

function playMockAd(): Promise<{ granted: boolean }> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve({ granted: true }), 900);
  });
}

function useIsMobileReserveTray() {
  const [isMobileReserveTray, setIsMobileReserveTray] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(max-width: 1023px)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobileReserveTray(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobileReserveTray;
}

function ReservePiecePreview({ piece }: { piece: BlockPiece | null }) {
  const cells = piece?.cells ?? [];
  const minRow = cells.length > 0 ? Math.min(...cells.map((cell) => cell.row)) : 0;
  const minCol = cells.length > 0 ? Math.min(...cells.map((cell) => cell.col)) : 0;
  const width = cells.length > 0 ? Math.max(...cells.map((cell) => cell.col)) - minCol + 1 : 1;
  const height = cells.length > 0 ? Math.max(...cells.map((cell) => cell.row)) - minRow + 1 : 1;
  const blockColor = BLOCK_COLOR_MAP[piece?.colorId ?? "peanut"] ?? BLOCK_COLOR_MAP.peanut;
  const borderColor = BLOCK_BORDER_MAP[piece?.colorId ?? "peanut"] ?? BLOCK_BORDER_MAP.peanut;

  return (
    <div className="grid h-[70px] w-[70px] place-items-center rounded-[18px] border border-[#8a7d65]/22 bg-[#fdf6ea]/88">
      {piece ? (
        <div
          className="grid gap-[4px]"
          style={{
            gridTemplateColumns: `repeat(${width}, 15px)`,
            gridTemplateRows: `repeat(${height}, 15px)`,
          }}
        >
          {cells.map((cell) => (
            <span
              key={`${cell.row}-${cell.col}`}
              style={{
                gridColumn: cell.col - minCol + 1,
                gridRow: cell.row - minRow + 1,
                width: 15,
                height: 15,
                borderRadius: 5,
                background: blockColor,
                border: `1.5px solid ${borderColor}`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      ) : (
        <span className="text-[24px] font-black text-[#8a7d65]/36">+</span>
      )}
    </div>
  );
}
