import { useCallback, useRef, useState } from "react";
import type {
  BlockBlastWinkIntegration,
  WinkRound,
} from "@/integrations/wink/useWinkIntegration";

interface FinalizationState {
  roundId: string;
  finalScore: number;
  playTimeMs: number;
  playTimeSec: number;
  scoreSubmitted: boolean;
  completed: boolean;
  promise: Promise<void> | null;
}

export function useRoundFinalization(wink: BlockBlastWinkIntegration) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeRoundRef = useRef<WinkRound | null>(null);
  const finalizationRef = useRef<FinalizationState | null>(null);

  const onRoundStart = useCallback(() => {
    if (activeRoundRef.current) return;
    activeRoundRef.current = wink.startRound();
  }, [wink]);

  const onGameEnd = useCallback((score: number) => {
    const round = activeRoundRef.current;
    if (!round) return Promise.resolve();

    const existing = finalizationRef.current;
    let state: FinalizationState;
    if (existing && existing.roundId === round.roundId) {
      // A finalization for this round is already in flight — join it instead of
      // starting a second submit/complete pair for the same game-over.
      if (existing.promise) return existing.promise;
      state = existing;
    } else {
      const playTimeMs = Date.now() - round.startedAtMs;
      state = {
        roundId: round.roundId,
        finalScore: score,
        playTimeMs,
        playTimeSec: Math.round(playTimeMs / 1000),
        scoreSubmitted: false,
        completed: false,
        promise: null,
      };
      finalizationRef.current = state;
    }

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
          // Awaited deliberately: completeRound is async, so an un-awaited call
          // would mark the round completed on a promise that later rejects and
          // leave the failure as an unhandled rejection.
          await wink.completeRound(round, state.playTimeMs);
          state.completed = true;
        } catch (err) {
          console.error("[Wink] completeRound failed", err);
          setSubmitError((prev) => prev ? prev + " - Không thể hoàn tất ván." : "Không thể hoàn tất ván. Vui lòng thử lại.");
          hasError = true;
        }
      }

      // Only release the round once both halves have landed, so a retry keeps
      // reporting against the same roundId.
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
