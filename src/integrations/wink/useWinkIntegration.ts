import { useEffect, useState, useCallback } from "react";
import { winkGame, type WinkRound } from "./client";
import type { WinkBridgeState, LeaderboardEntry } from "./wink-bridge";

export function isOfflineModeEnabled(env: { dev: boolean; flag: string | undefined }) {
  return env.dev && env.flag === 'true';
}

export function useWinkIntegration() {
  const [state, setState] = useState<WinkBridgeState | null>(winkGame.state);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [hostPaused, setHostPaused] = useState(false);
  const [parentMuted, setParentMuted] = useState(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    
    unsubs.push(winkGame.observe((newState) => {
      setState(newState);
    }));

    unsubs.push(winkGame.bindLifecycle({
      onPause: () => setHostPaused(true),
      onResume: () => setHostPaused(false),
      onMute: () => setParentMuted(true),
      onUnmute: () => setParentMuted(false),
    }));

    return () => unsubs.forEach(fn => fn());
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    const res = await winkGame.refreshLeaderboard({ limit: 100 });
    setLeaderboard(res.entries);
  }, []);

  const submitFinalScore = useCallback(async (input: { roundId: string, score: number, playTimeSec: number, qualifies: boolean }) => {
    if (!input.qualifies) return;
    return winkGame.submitFinalScore({
      score: input.score,
      playTime: input.playTimeSec,
      metadata: { roundId: input.roundId }
    });
  }, []);
  
  const completeRound = useCallback((round: WinkRound, playDurationMs: number) => {
    return winkGame.completeRound(round, { playDurationMs });
  }, []);

  const startRound = useCallback(() => {
    return winkGame.startRound();
  }, []);
  
  const isMissing = !window.WinkBridge && !isOfflineModeEnabled({ dev: import.meta.env.DEV, flag: import.meta.env.VITE_OFFLINE });

  if (isMissing) {
    return {
      state: null,
      capabilities: { getLeaderboard: false, submitScore: false, complete: false },
      leaderboard: [],
      refreshLeaderboard: async () => { throw new Error("WinkBridge is missing"); },
      submitFinalScore: async () => { throw new Error("WinkBridge is missing"); },
      completeRound: () => { throw new Error("WinkBridge is missing"); },
      startRound: () => { throw new Error("WinkBridge is missing"); },
      hostPaused: false,
      parentMuted: false,
      error: { code: 'BRIDGE_MISSING', message: 'Bridge missing', retryable: false },
      phase: 'error',
      mode: 'wink'
    };
  }

  return {
    state,
    capabilities: winkGame.capabilities,
    leaderboard,
    refreshLeaderboard,
    submitFinalScore,
    completeRound,
    startRound,
    hostPaused,
    parentMuted,
    error: state?.error ?? null,
    phase: state?.phase ?? 'error',
    mode: state ? 'wink' : 'standalone'
  };
}
