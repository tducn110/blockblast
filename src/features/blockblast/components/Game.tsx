import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, RotateCcw, Settings, Heart, Clapperboard } from "lucide-react";
import { useBlockBlastGame, type BoomEvent } from "@/features/blockblast/hooks/useBlockBlastGame";
import { Button } from "@/components/shared/Button";
import { IconButton } from "@/components/shared/IconButton";
import { LogoBubble } from "@/components/shared/LogoBubble";
import { GameHUD } from "@/features/blockblast/components/GameHUD";
import { Mascot } from "@/features/blockblast/components/Mascot";
import { PixiBlockBlastCanvas } from "@/features/blockblast/components/PixiBlockBlastCanvas";
import { SlashScoreOverlay } from "@/features/blockblast/components/SlashScoreOverlay";
import { blockBlastAudio } from "@/features/blockblast/audio/blockBlastAudio";
import { buildLeaderboardModel } from "@/features/blockblast/lib/dashboardHelpers";
import { useTranslation } from "react-i18next";
import { RankingRow } from "@/features/blockblast/screens/Dashboard";
import type { ScoreData } from "@/features/blockblast/hooks/useScoreData";
import {
  BLOCK_BORDER_MAP,
  BLOCK_COLOR_MAP,
  type BlockPiece,
} from "@/features/blockblast/game/blockBlastLogic";
const showRewardedVideo = ({ beforeAd, afterAd }: { name: string, beforeAd?: () => void, afterAd?: () => void }) => {
  return new Promise<boolean>((resolve) => {
    beforeAd?.();
    setTimeout(() => {
      afterAd?.();
      resolve(true);
    }, 1000);
  });
};
interface GameProps {
  scoreData: ScoreData;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  shakeEnabled: boolean;
  audioStatus: "idle" | "ready";
  unlockAudio: () => void | Promise<void>;
  scenery: "normal" | "boom";
  paused: boolean;
  onBoom: (event: BoomEvent) => void;
  onRoundStart?: () => void;
  onGameEnd?: (score: number) => Promise<void>;
  onDashboard: () => void;
  onSettings: () => void;
}

export function Game({
  scoreData,
  sfxEnabled,
  musicEnabled,
  shakeEnabled,
  audioStatus,
  unlockAudio,
  scenery,
  paused,
  onBoom,
  onRoundStart,
  onGameEnd,
  onDashboard,
  onSettings,
}: GameProps) {
  const [roundSealed, setRoundSealed] = useState(false);
  const { t } = useTranslation();

  const game = useBlockBlastGame({
    bestScore: scoreData.bestScore,
    onGameOver: (result) => {
      scoreData.handleGameOver(result);
    },
    sfxEnabled,
    musicEnabled,
    paused: paused || roundSealed,
  });
  const lastBoomEventIdRef = useRef<string | null>(null);
  const [adReplayStatus, setAdReplayStatus] = useState<"idle" | "loading">("idle");
  const [isReserveAdLoading, setIsReserveAdLoading] = useState(false);
  const [continuePromptState, setContinuePromptState] = useState<"idle" | "doubled">("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const finalizingRef = useRef(false);

  useEffect(() => {
    if (game.status === "playing") {
      setContinuePromptState("idle");
      setRoundSealed(false);
    }
  }, [game.status]);

  useEffect(() => {
    if (game.piecesPlaced === 1 && game.status === "playing") {
      onRoundStart?.();
    }
  }, [game.piecesPlaced, game.status, onRoundStart]);

  const { currentPlayer } = buildLeaderboardModel(scoreData.stats, "Người chơi");


  useEffect(() => {
    if (!game.boomEvent || lastBoomEventIdRef.current === game.boomEvent.id) return;
    lastBoomEventIdRef.current = game.boomEvent.id;
    onBoom(game.boomEvent);
  }, [game.boomEvent, onBoom]);

  const mascotMood =
    scenery === "boom" ? "boom" : game.status === "gameOver" ? "gameOver" : "idle";
  const mascotVariantIndex = scenery === "boom" ? 2 : 0;
  const showMobileReserveSlot = useIsMobileReserveTray();

  useEffect(() => {
    blockBlastAudio.setMobileAudioMode(showMobileReserveSlot);
  }, [showMobileReserveSlot]);

  const reserveStoreLabel =
    game.selectedPieceId === game.reservePiece?.id
      ? t('UNSELECT')
      : game.selectedPieceId && game.reservePiece
        ? t('SWAP')
        : game.selectedPieceId
          ? t('STORE')
        : game.reservePiece
          ? t('TAKE_OUT')
          : t('STORE');
  const reserveStoreDisabled =
    game.status !== "playing" ||
    game.adPending ||
    !game.reserveUnlocked ||
    (!game.selectedPieceId && !game.reservePiece);
  const adActionDisabled =
    game.status !== "playing" || game.reserveUnlocked || isReserveAdLoading || game.adPending;
  const handleUnlockReserve = useCallback(async () => {
    if (adActionDisabled || !game.beginAd("reserve")) return;

    setIsReserveAdLoading(true);
    try {
      const rewarded = await showRewardedVideo({ name: "unlock_reserve_slot" });
      game.completeAd("reserve", rewarded);
    } finally {
      setIsReserveAdLoading(false);
    }
  }, [adActionDisabled, game.beginAd, game.completeAd]);
  const handleReserveAction = () => {
    game.useReserveSlot();
  };
  const handleAdReplay = useCallback(async () => {
    if (adReplayStatus !== "idle" || !game.beginAd("revive")) return;

    setAdReplayStatus("loading");
    try {
      const rewarded = await showRewardedVideo({ name: "revive_after_loss" });
      game.completeAd("revive", rewarded);
    } finally {
      setAdReplayStatus("idle");
    }
  }, [adReplayStatus, game.beginAd, game.completeAd]);

  const handleRestart = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    setRoundSealed(true);
    try {
      await onGameEnd?.(game.score);
      game.resetGame();
      setRoundSealed(false);
      setContinuePromptState("idle");
    } catch (error) {
      console.error("[Wink] round finalization failed", error);
    } finally {
      finalizingRef.current = false;
      setIsFinalizing(false);
    }
  }, [game.score, game.resetGame, onGameEnd]);

  const handleDashboard = useCallback(async () => {
    if (finalizingRef.current) return;
    if (game.status === "gameOver") {
      finalizingRef.current = true;
      setIsFinalizing(true);
      setRoundSealed(true);
      try {
        await onGameEnd?.(game.score);
      } catch (error) {
        console.error("[Wink] round finalization failed", error);
      } finally {
        finalizingRef.current = false;
        setIsFinalizing(false);
      }
    }
    onDashboard();
  }, [game.status, game.score, onGameEnd, onDashboard]);

  return (
    <section
      className="blockblast-game-shell w-full h-full min-h-0 max-w-[440px] lg:h-auto lg:max-w-[1080px] mx-auto bg-[#fdf6ea]/96 border-2 border-[#8a7d65]/34 rounded-[28px] p-[14px_14px_18px] lg:p-[30px] shadow-[0_18px_46px_rgba(42,36,24,0.18)] flex flex-col lg:flex-row gap-[12px] lg:gap-[38px] relative font-['Be_Vietnam_Pro',sans-serif] overflow-hidden"
      style={{
        boxShadow:
          scenery === "boom"
            ? "0 22px 58px rgba(184,90,34,0.28), 0 0 0 2px rgba(240,184,64,0.42) inset"
            : undefined,
      }}
    >
      {audioStatus !== "ready" && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-[#2a2418]/18 p-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blockblast-audio-start-title"
        >
          <button
            type="button"
            className="flex min-h-[132px] w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-[26px] border-2 border-[#c8920c] bg-[#fdf6ea] px-6 py-5 text-center text-[#2a2418] shadow-[0_18px_42px_rgba(42,36,24,0.24)]"
            onClick={() => void unlockAudio()}
          >
            <span id="blockblast-audio-start-title" className="text-[20px] font-black">
              {t("AUDIO_START_TITLE")}
            </span>
          </button>
        </div>
      )}
      
      {/* Left Column: UI Controls (Header, HUD, Instructions) */}
      <div className="blockblast-game-controls flex shrink-0 flex-col gap-[12px] lg:gap-[18px] lg:w-[340px] lg:shrink-0 lg:py-[8px]">
        {/* Header Row (Mobile) / Stack (PC) */}
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <LogoBubble size={34} />
            <div className="min-w-0">
              <div className="text-[15px] lg:text-[20px] font-black text-[#2a2418] leading-[1.05]">
                {t('TITLE')}
              </div>
              <div className="text-[9px] lg:text-[11px] font-extrabold text-[#8a7d65] tracking-[0.5px] mt-0.5">
                {t('SUBTITLE')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <IconButton label={t('TOOLTIP_LEADERBOARD')} onClick={handleDashboard} size={40} disabled={isFinalizing || roundSealed}>
              <Trophy size={20} />
            </IconButton>
            <IconButton label={t('SETTINGS')} onClick={onSettings} size={40} disabled={isFinalizing || roundSealed}>
              <Settings size={22} />
            </IconButton>
            <IconButton label={t('TOOLTIP_PLAY_AGAIN')} onClick={handleRestart} size={40} disabled={isFinalizing}>
              <RotateCcw size={20} />
            </IconButton>
          </div>
        </div>

        <div className="blockblast-info-panel flex flex-col gap-[10px] lg:gap-[14px] lg:rounded-[24px] lg:border lg:border-[#8a7d65]/18 lg:bg-[#efe3c4]/38 lg:p-[16px] lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
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

            <div className="flex min-w-0 flex-col justify-center gap-[10px] rounded-[20px] border-[2px] border-[#e87432]/40 bg-[#f5ecd7]/64 p-[14px]">
              <div>
                <div className="text-[13px] font-black uppercase tracking-[0.8px] text-[#8e4e22]">
                  {t('REWARD_AD')}
                </div>
                <div className="mt-[2px] text-[12px] font-bold leading-[1.4] text-[#8a7d65]">
                  {game.reserveUnlocked
                    ? t('RESERVE_UNLOCKED')
                    : t('RESERVE_LOCKED')}
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                disabled={adActionDisabled}
                onClick={handleUnlockReserve}
                style={{ alignSelf: "flex-start", minWidth: 132, minHeight: 38, paddingLeft: 14, paddingRight: 14 }}
              >
                {isReserveAdLoading ? t('BTN_AD_LOADING') : game.reserveUnlocked ? t('ALREADY_UNLOCKED') : (
                  <>
                    <Clapperboard size={18} strokeWidth={2.25} />
                    <span>{t('WATCH_AD')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className={`flex items-center justify-between gap-[14px] rounded-[20px] border-[2px] ${game.reserveUnlocked ? "border-[#e87432]/30 bg-[#fdf6ea]" : "border-[#8a7d65]/16 bg-[#fdf6ea]/78"} p-[12px]`}>
            <div className="flex items-center gap-[12px]">
              <ReservePiecePreview piece={game.reserveUnlocked ? game.reservePiece : null} unlocked={game.reserveUnlocked} />
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.7px] text-[#8e4e22]">
                  {t('RESERVE_BOX')}
                </div>
                <div className="text-[11px] font-bold leading-[1.35] text-[#8a7d65]">
                  {t('RESERVE_BOX_HINT')}
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
      <div className="blockblast-game-board relative flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
        <div className="blockblast-canvas-wrap w-full h-full min-h-0 relative max-w-[590px] lg:h-auto">
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
            comboShakeEvent={shakeEnabled ? game.comboShakeEvent : null}
            paused={paused}
            interactionLocked={paused || game.adPending}
            onSelectPiece={game.selectPiece}
            onPlacePiece={game.placePiece}
            onUnlockReserve={handleUnlockReserve}
            onUseReserveSlot={game.useReserveSlot}
          />
          <SlashScoreOverlay items={game.feedback} />
          {game.status === "gameOver" && (
            <div className="absolute inset-0 z-30 backdrop-blur-[6px] bg-white/10 rounded-[12px] animate-[fadeScaleIn_0.32s_ease] pointer-events-none" />
          )}
        </div>
      </div>
      {game.status === "reviveOffer" && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-[24px] animate-[fadeScaleIn_0.32s_ease] font-['Be_Vietnam_Pro',sans-serif]">
          <div className="absolute inset-0 bg-[#2a2418]/40" />
          
          <div role="dialog" aria-modal="true" className="relative bg-[#fdf6ea] shadow-[0_24px_48px_rgba(42,36,24,0.25)] rounded-[32px] p-[28px_24px] flex flex-col items-center gap-[24px] w-full max-w-[340px] max-h-[calc(100dvh-32px)] overflow-y-auto border-2 border-[#8a7d65]/20">
            <h2 className="text-[24px] font-extrabold text-[#e87432] text-center uppercase">
              {t('CONTINUE')}
            </h2>
            <div className="flex gap-[16px] w-full">
              <Button
                variant="primary"
                size="lg"
                disabled={adReplayStatus !== "idle"}
                onClick={handleAdReplay}
                style={{ flex: 1, minHeight: 56, fontSize: 16 }}
              >
                {adReplayStatus === "idle" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Clapperboard size={18} strokeWidth={2.25} />
                    <span className="flex items-center justify-center gap-1.5">
                      {t('YES')} <Heart size={20} className="fill-current" />
                    </span>
                  </span>
                ) : (
                  t('BTN_AD_LOADING')
                )}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={adReplayStatus !== "idle"}
                onClick={game.declineRevive}
                style={{ flex: 1, minHeight: 56, fontSize: 16 }}
              >
                {t('NO')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {game.status === "gameOver" && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-[24px] animate-[fadeScaleIn_0.32s_ease] font-['Be_Vietnam_Pro',sans-serif]">
          <div className="absolute inset-0 bg-[#2a2418]/40" />
          
          <div role="dialog" aria-modal="true" className="relative bg-[#fdf6ea] shadow-[0_24px_48px_rgba(42,36,24,0.25)] rounded-[32px] p-[28px_24px] flex flex-col gap-[18px] w-full max-w-[420px] max-h-[calc(100dvh-32px)] overflow-y-auto border-2 border-[#8a7d65]/20">
            {/* Header: Score */}
            <div className="bg-[#8a7d65]/10 p-[24px_24px] rounded-[20px] flex flex-col items-center gap-[8px] shrink-0">
              <div className="text-[14px] text-[#8a7d65] font-bold uppercase tracking-[0.05em]">{t('SCORE')}</div>
              <div className="text-[40px] leading-[1.05] font-extrabold text-[#e87432]">
                {game.score.toLocaleString("vi-VN")}
              </div>
            </div>

            {/* Leaderboard Section */}
            <section className="flex flex-col gap-[10px] text-left shrink-0 w-full mx-auto">
              <div className="flex items-center justify-between gap-[12px]">
                <div className="flex items-center gap-[8px]">
                  <Trophy size={22} className="text-[#e87432]" />
                  <h2 className="m-0 text-[18px] leading-[1.2] text-[#2a2418] font-extrabold">
                    {t('ACHIEVEMENTS')}
                  </h2>
                </div>
                <span className="text-[12px] font-extrabold text-[#8a7d65] uppercase tracking-[0.08em]">
                  {t('RANKING')}
                </span>
              </div>

              <div className="flex flex-col gap-[8px]">
                {currentPlayer ? (
                  <RankingRow key={`${currentPlayer.name}-${currentPlayer.rank ?? "new"}`} entry={currentPlayer} highlight={true} />
                ) : (
                  <div className="rounded-[16px] border-2 border-[#e87432]/30 bg-[#e87432]/10 p-[12px_14px] text-[13px] font-extrabold text-[#4a4232]">
                    {t('UNRANKED')}
                  </div>
                )}
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 shrink-0 items-center mt-1">
              <Button
                variant="secondary"
                size="lg"
                disabled={continuePromptState === "doubled" || adReplayStatus !== "idle" || roundSealed}
                onClick={async () => {
                  setAdReplayStatus("loading");
                  const rewarded = await showRewardedVideo({ name: "double_final_score" });
                  setAdReplayStatus("idle");
                  if (!rewarded) return;
                  const doubledScore = game.score * 2;
                  scoreData.updateLatestGameResult({
                    score: doubledScore,
                    maxCombo: game.maxCombo,
                    linesCleared: game.linesCleared,
                    piecesPlaced: game.piecesPlaced,
                  });
                  game.doubleScore();
                  setContinuePromptState("doubled");
                }}
                style={{
                  width: "100%",
                  minHeight: 56,
                  fontSize: 16,
                  boxShadow: "0 12px 24px rgba(240,184,64,0.34), inset 0 1px 0 rgba(255,255,255,0.46)",
                }}
              >
                {adReplayStatus === "loading"
                  ? t('BTN_AD_LOADING')
                  : continuePromptState === "doubled"
                    ? t('DOUBLED')
                    : (
                      <span className="flex items-center justify-center gap-2">
                        <Clapperboard size={18} strokeWidth={2.25} />
                        <span>{t('DOUBLE_REWARD')}</span>
                      </span>
                    )}
              </Button>
              <Button 
                onClick={handleRestart} 
                size="md" 
                variant="primary"
                disabled={isFinalizing}
                style={{
                  width: "100%",
                  minHeight: 48,
                  fontSize: 15,
                }}
              >
                {t('BTN_PLAY_AGAIN')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
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

function ReservePiecePreview({ piece, unlocked }: { piece: BlockPiece | null; unlocked: boolean }) {
  const cells = piece?.cells ?? [];
  const minRow = cells.length > 0 ? Math.min(...cells.map((cell) => cell.row)) : 0;
  const minCol = cells.length > 0 ? Math.min(...cells.map((cell) => cell.col)) : 0;
  const width = cells.length > 0 ? Math.max(...cells.map((cell) => cell.col)) - minCol + 1 : 1;
  const height = cells.length > 0 ? Math.max(...cells.map((cell) => cell.row)) - minRow + 1 : 1;
  const blockColor = BLOCK_COLOR_MAP[piece?.colorId ?? "peanut"] ?? BLOCK_COLOR_MAP.peanut;
  const borderColor = BLOCK_BORDER_MAP[piece?.colorId ?? "peanut"] ?? BLOCK_BORDER_MAP.peanut;

  return (
    <div className={`grid h-[70px] w-[70px] place-items-center rounded-[18px] bg-[#fdf6ea]/88 ${unlocked && !piece ? "border-[3px] border-dashed border-[#e87432]/60 bg-[#e87432]/5" : "border-[2px] border-[#8a7d65]/22"}`}>
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
