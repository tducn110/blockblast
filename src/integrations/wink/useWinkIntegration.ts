/**
 * useWinkIntegration — connects Block Blast to the Wink platform bridge.
 *
 * Ported from the certified FruitSlashing/2048 reference hook, which is the
 * only shape `client.ts` actually exposes. There is one deliberate divergence
 * from that reference, and it is why this file does not simply return the
 * canonical `WinkIntegration`: Block Blast opens a semantic round from inside
 * the game (`startRound`) and finalises it with the round object it was handed
 * (`completeRound(round, playDurationMs)`). `useRoundFinalization` owns the
 * retry bookkeeping for a game-over and needs a stable round id plus a start
 * timestamp to key it on.
 *
 * Offline mode (VITE_WINK_OFFLINE_MODE=true, dev only) bypasses the bridge for
 * local development. It does NOT certify the iframe/security contract.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWinkGameClient,
  getInstalledWinkBridge,
  WinkGameClientError,
} from "./client";
import type {
  RedactedWinkState,
  WinkCapabilities,
  WinkGameClient,
  WinkIntegration,
  WinkIntegrationError,
  WinkIntegrationErrorCode,
  WinkLeaderboardEntry,
} from "./types";

/** A semantic round, opened by the game and carried until it is finalised. */
export interface WinkRound {
  readonly roundId: string;
  readonly startedAtMs: number;
}

export interface BlockBlastWinkIntegration
  extends Omit<WinkIntegration, "completeRound"> {
  startRound(): WinkRound;
  completeRound(round: WinkRound, playDurationMs: number): Promise<void>;
}

// Mirrors the bounds client.ts validates against; see clampDurationMs.
const MAX_PLAY_DURATION_MS = 86_400_000;
const MAX_PLAY_TIME_SECONDS = 86_400;

const EMPTY_CAPABILITIES: WinkCapabilities = Object.freeze({
  getLeaderboard: false,
  submitScore: false,
  complete: false,
});

const OFFLINE_STATE: RedactedWinkState = Object.freeze({
  phase: "ready_anonymous",
  gameId: null,
  environment: "dev",
  sessionId: null,
  identityType: "anonymous",
  capabilities: EMPTY_CAPABILITIES,
  expiresAt: null,
  lifecycle: Object.freeze({ paused: false, muted: false }),
  error: null,
});

const DISCONNECTED_STATE: RedactedWinkState = Object.freeze({
  phase: "error",
  gameId: null,
  environment: null,
  sessionId: null,
  identityType: null,
  capabilities: EMPTY_CAPABILITIES,
  expiresAt: null,
  lifecycle: Object.freeze({ paused: false, muted: false }),
  error: null,
});

const SAFE_ERROR_MESSAGES: Record<WinkIntegrationErrorCode, string> = {
  PARENT_REQUIRED: "Mini-game phải được mở trong iframe Wink.",
  BRIDGE_READY_TIMEOUT: "Không thể khởi tạo kết nối với Wink.",
  PROTOCOL_MISMATCH: "Phiên bản giao thức Wink không tương thích.",
  RUNTIME_CONFIG_INVALID: "Cấu hình mini-game không hợp lệ.",
  SESSION_CREATE_FAILED: "Không thể tạo phiên chơi.",
  SESSION_RENEWAL_FAILED: "Không thể gia hạn phiên chơi.",
  SESSION_EXPIRED: "Phiên chơi đã hết hạn.",
  CAPABILITY_DENIED: "Thao tác này không được cấp quyền cho phiên hiện tại.",
  API_NETWORK_ERROR: "Không thể kết nối dịch vụ Wink.",
  MESSAGE_REJECTED: "Thông điệp từ Wink không hợp lệ.",
  BRIDGE_MISSING: "Wink bridge chưa được cài đặt.",
  INVALID_SCORE: "Điểm số cuối không hợp lệ.",
  INVALID_ROUND: "Mã vòng chơi không hợp lệ.",
};

export function isOfflineModeEnabled(input: {
  dev: boolean;
  flag: string | undefined;
}): boolean {
  return input.dev === true && input.flag === "true";
}

function isIntegrationErrorCode(
  value: unknown,
): value is WinkIntegrationErrorCode {
  return typeof value === "string" && Object.hasOwn(SAFE_ERROR_MESSAGES, value);
}

function safeError(
  value: unknown,
  fallbackCode: WinkIntegrationErrorCode = "API_NETWORK_ERROR",
): WinkIntegrationError {
  const candidateCode =
    value instanceof WinkGameClientError
      ? value.code
      : typeof value === "object" && value !== null && "code" in value
        ? (value as { code?: unknown }).code
        : value;
  const code = isIntegrationErrorCode(candidateCode)
    ? candidateCode
    : fallbackCode;
  const retryable =
    value instanceof WinkGameClientError
      ? value.retryable
      : code === "API_NETWORK_ERROR" || code === "BRIDGE_READY_TIMEOUT";
  return Object.freeze({
    code,
    retryable,
    message: SAFE_ERROR_MESSAGES[code],
  });
}

function stateWithError(
  state: RedactedWinkState,
  error: WinkIntegrationError | null,
): RedactedWinkState {
  return Object.freeze({
    ...state,
    error,
    lifecycle: Object.freeze({ ...state.lifecycle }),
    capabilities: Object.freeze({ ...state.capabilities }),
  });
}

function stateWithLifecycle(
  state: RedactedWinkState,
  lifecycle: Partial<RedactedWinkState["lifecycle"]>,
): RedactedWinkState {
  return stateWithError(
    {
      ...state,
      lifecycle: Object.freeze({ ...state.lifecycle, ...lifecycle }),
    },
    state.error,
  );
}

/**
 * The bridge rejects a duration outside [0, 24h] as INVALID_ROUND. A phone that
 * slept mid-round produces exactly that, and losing the completion over an
 * untrusted wall-clock reading is worse than reporting the boundary. The score
 * itself is deliberately NOT clamped — that is a game value, and a wrong one
 * should fail loudly rather than land on the leaderboard.
 */
function clampDurationMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), MAX_PLAY_DURATION_MS);
}

function clampPlayTimeSec(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), MAX_PLAY_TIME_SECONDS);
}

/**
 * client.ts checks round ids against a strict UUID pattern, so the fallback has
 * to produce a real v4 rather than a readable pseudo-id.
 */
function newRoundId(): string {
  const cr = globalThis.crypto;
  if (cr && typeof cr.randomUUID === "function") return cr.randomUUID();
  const bytes = new Uint8Array(16);
  cr.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function initialConnection(): {
  client: WinkGameClient | null;
  state: RedactedWinkState;
  error: WinkIntegrationError | null;
} {
  const bridge = getInstalledWinkBridge();
  if (!bridge) {
    const error = safeError(undefined, "BRIDGE_MISSING");
    return {
      client: null,
      state: stateWithError(DISCONNECTED_STATE, error),
      error,
    };
  }

  try {
    const client = createWinkGameClient(bridge);
    const state = client.getState();
    return { client, state, error: state.error };
  } catch (value) {
    const error = safeError(value, "MESSAGE_REJECTED");
    return {
      client: null,
      state: stateWithError(DISCONNECTED_STATE, error),
      error,
    };
  }
}

function readBuildFlag(): boolean {
  return isOfflineModeEnabled({
    dev: import.meta.env.DEV === true,
    flag: import.meta.env.VITE_WINK_OFFLINE_MODE,
  });
}

export function useWinkIntegration(): BlockBlastWinkIntegration {
  const offline = readBuildFlag();
  const connectionRef = useRef<{
    initialized: boolean;
    client: WinkGameClient | null;
    state: RedactedWinkState;
    error: WinkIntegrationError | null;
  }>({
    initialized: false,
    client: null,
    state: OFFLINE_STATE,
    error: null,
  });

  if (!connectionRef.current.initialized) {
    connectionRef.current.initialized = true;
    if (!offline) {
      const connection = initialConnection();
      connectionRef.current.client = connection.client;
      connectionRef.current.state = connection.state;
      connectionRef.current.error = connection.error;
    }
  }

  const connection = connectionRef.current;
  const [state, setState] = useState<RedactedWinkState>(connection.state);
  const [error, setError] = useState<WinkIntegrationError | null>(
    connection.error,
  );
  const [hostPaused, setHostPaused] = useState(
    connection.state.lifecycle.paused,
  );
  const [parentMuted, setParentMuted] = useState(
    connection.state.lifecycle.muted,
  );
  const [leaderboard, setLeaderboard] = useState<
    readonly WinkLeaderboardEntry[]
  >([]);

  useEffect(() => {
    const client = connection.client;
    if (!client) return;

    const applyState = (next: RedactedWinkState) => {
      const projectedError = next.error ? safeError(next.error) : null;
      setState(stateWithError(next, projectedError));
      setError(projectedError);
      setHostPaused(next.lifecycle.paused);
      setParentMuted(next.lifecycle.muted);
    };

    const cleanups: Array<() => void> = [];
    try {
      cleanups.push(client.subscribe(applyState));
      cleanups.push(
        client.onPause(() => {
          setHostPaused(true);
          setState((current) => stateWithLifecycle(current, { paused: true }));
        }),
      );
      cleanups.push(
        client.onResume(() => {
          setHostPaused(false);
          setState((current) => stateWithLifecycle(current, { paused: false }));
        }),
      );
      cleanups.push(
        client.onMute(() => {
          setParentMuted(true);
          setState((current) => stateWithLifecycle(current, { muted: true }));
        }),
      );
      cleanups.push(
        client.onUnmute(() => {
          setParentMuted(false);
          setState((current) => stateWithLifecycle(current, { muted: false }));
        }),
      );
    } catch (value) {
      const nextError = safeError(value, "MESSAGE_REJECTED");
      setError(nextError);
      setState((current) => stateWithError(current, nextError));
      cleanups.splice(0).forEach((cleanup) => cleanup());
    }

    return () => {
      cleanups.splice(0).forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Cleanup must not turn a normal React unmount into an integration error.
        }
      });
    };
  }, [connection]);

  const recordError = useCallback(
    (value: unknown, fallback?: WinkIntegrationErrorCode) => {
      const nextError = safeError(value, fallback);
      setError(nextError);
      setState((current) => stateWithError(current, nextError));
      return nextError;
    },
    [],
  );

  const startRound = useCallback(
    (): WinkRound =>
      Object.freeze({ roundId: newRoundId(), startedAtMs: Date.now() }),
    [],
  );

  const refreshLeaderboard = useCallback(async () => {
    if (offline) {
      setLeaderboard([]);
      return;
    }
    if (!connection.client) {
      throw recordError(undefined, "BRIDGE_MISSING");
    }
    if (!state.capabilities.getLeaderboard) {
      throw recordError(undefined, "CAPABILITY_DENIED");
    }
    try {
      const entries = await connection.client.getLeaderboard({ limit: 100 });
      setLeaderboard(entries);
      setError(null);
      setState((current) => stateWithError(current, null));
    } catch (value) {
      throw recordError(value);
    }
  }, [connection, offline, recordError, state.capabilities.getLeaderboard]);

  const submitFinalScore = useCallback(
    async (input: {
      roundId: string;
      score: number;
      playTimeSec: number;
      qualifies: boolean;
    }) => {
      if (!input.qualifies || offline) return;
      if (!connection.client) {
        throw recordError(undefined, "BRIDGE_MISSING");
      }
      if (!state.capabilities.submitScore) {
        throw recordError(undefined, "CAPABILITY_DENIED");
      }
      try {
        await connection.client.submitScore({
          score: input.score,
          playTime: clampPlayTimeSec(input.playTimeSec),
          metadata: { roundId: input.roundId },
        });
        setError(null);
        setState((current) => stateWithError(current, null));
      } catch (value) {
        throw recordError(value);
      }
    },
    [connection, offline, recordError, state.capabilities.submitScore],
  );

  const completeRound = useCallback(
    async (round: WinkRound, playDurationMs: number) => {
      if (offline) return;
      if (!connection.client) {
        throw recordError(undefined, "BRIDGE_MISSING");
      }
      if (!state.capabilities.complete) {
        throw recordError(undefined, "CAPABILITY_DENIED");
      }
      try {
        await connection.client.complete({
          roundId: round.roundId,
          playDurationMs: clampDurationMs(playDurationMs),
        });
        setError(null);
        setState((current) => stateWithError(current, null));
      } catch (value) {
        throw recordError(value);
      }
    },
    [connection, offline, recordError, state.capabilities.complete],
  );

  const projectedState = stateWithError(state, error);
  return {
    mode: offline ? "offline" : "wink",
    phase: projectedState.phase,
    capabilities: projectedState.capabilities,
    state: projectedState,
    client: connection.client,
    hostPaused,
    parentMuted,
    error,
    leaderboard,
    refreshLeaderboard,
    submitFinalScore,
    startRound,
    completeRound,
  };
}
