import { useCallback, useRef, useState } from "react";
import type { WinkRound } from "@/integrations/wink/client";

interface FinalizationState {
  roundId: string;
  finalScore: number;
  playTimeMs: number;
  playTimeSec: number;
  scoreSubmitted: boolean;
  completed: boolean;
  promise: Promise<void> | null;
}

export function useRoundFinalization(wink: any) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeRoundRef = useRef<WinkRound | null>(null);
  const finalizationRef = useRef<FinalizationState | null>(null);

  const onRoundStart = useCallback(() => {
    if (activeRoundRef.current) return;
    const round = wink.startRound();
    activeRoundRef.current = round;
  }, [wink]);

  const onGameEnd = useCallback((score: number) => {
    const round = activeRoundRef.current;
    if (!round) return Promise.resolve();

    if (finalizationRef.current?.roundId === round.roundId) {
      if (finalizationRef.current.promise) {
        return finalizationRef.current.promise;
      }
    } else {
      const playTimeMs = Date.now() - round.startedAtMs;
      finalizationRef.current = {
        roundId: round.roundId,
        finalScore: score,
        playTimeMs,
        playTimeSec: Math.round(playTimeMs / 1000),
        scoreSubmitted: false,
        completed: false,
        promise: null,
      };
    }

    const state = finalizationRef.current;
    
    state.promise = (async () => {
      let hasError = false;

      if (!state.scoreSubmitted) {
        try {
          setSubmitError(null);
          await wink.submitFinalScore({
            roundId: state.roundId,
            score: state.finalScore,
            playTimeSec: state.playTimeSec,
            qualifies: true,
          });
          state.scoreSubmitted = true;
        } catch (err: any) {
          if (err?.code === "CAPABILITY_DENIED") {
            setSubmitError("Bạn chưa đăng nhập để lưu điểm lên Wink");
            state.scoreSubmitted = true; 
          } else {
            console.error("[Wink] submitFinalScore failed", err);
            setSubmitError(err?.message || "Lỗi lưu điểm");
            hasError = true;
          }
        }
      }

      if (!state.completed) {
        try {
          wink.completeRound(round, state.playTimeMs);
          state.completed = true;
        } catch (err) {
          console.error("[Wink] completeRound failed", err);
          setSubmitError((prev) => prev ? prev + " - Không thể hoàn tất ván." : "Không thể hoàn tất ván. Vui lòng thử lại.");
          hasError = true;
        }
      }

      // THIS IS THE CRITICAL FIX REQUESTED BY USER
      if (state.completed && state.scoreSubmitted) {
        activeRoundRef.current = null;
      }

      state.promise = null;

      if (hasError) {
        throw new Error("Finalization failed");
      }

      if (wink.phase === "ready_anonymous" || wink.phase === "ready_authenticated") {
        try {
          await wink.refreshLeaderboard();
        } catch (err) {
          console.error("[Wink] refreshLeaderboard failed", err);
          setSubmitError((prev) => prev ? prev + " - Lỗi tải BXH." : "Không thể tải bảng xếp hạng mới.");
        }
      }
    })();

    return state.promise;
  }, [wink]);

  return {
    submitError,
    setSubmitError,
    activeRoundRef,
    onRoundStart,
    onGameEnd,
    finalizationRef
  };
}
