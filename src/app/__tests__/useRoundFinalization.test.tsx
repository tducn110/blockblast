// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useRoundFinalization } from '../useRoundFinalization';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({
  wink,
  onValue,
}: {
  wink: any;
  onValue: (value: ReturnType<typeof useRoundFinalization>) => void;
}) {
  onValue(useRoundFinalization(wink));
  return null;
}

async function mountProbe(
  wink: any,
  onValue: (value: ReturnType<typeof useRoundFinalization>) => void
) {
  const container = document.createElement('div');
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe wink={wink} onValue={onValue} />);
  });
  return {
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
    rerender: async () => {
      await act(async () => {
        root.render(<Probe wink={wink} onValue={onValue} />);
      });
    }
  };
}

describe('useRoundFinalization', () => {
  let mockWink: any;
  let mockRound: any;
  let latest: ReturnType<typeof useRoundFinalization>;

  beforeEach(() => {
    mockRound = { roundId: 'r-123', startedAtMs: Date.now() - 5000 };
    mockWink = {
      startRound: vi.fn(() => mockRound),
      submitFinalScore: vi.fn().mockResolvedValue(undefined),
      completeRound: vi.fn(),
      refreshLeaderboard: vi.fn().mockResolvedValue(undefined),
      phase: 'ready_authenticated',
    };
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('submit pass + complete pass → each called once', async () => {
    const mounted = await mountProbe(mockWink, (v) => { latest = v; });
    
    await act(async () => { latest.onRoundStart(); });
    expect(mockWink.startRound).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latest.onGameEnd(100);
    });

    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);
    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    expect(mockWink.refreshLeaderboard).toHaveBeenCalledTimes(1);
    expect(latest.activeRoundRef.current).toBeNull();
    
    await mounted.unmount();
  });

  it('submit pass + complete fail → retry only complete', async () => {
    mockWink.completeRound = vi.fn().mockImplementationOnce(() => { throw new Error('Network error'); });
    
    const mounted = await mountProbe(mockWink, (v) => { latest = v; });
    
    await act(async () => { latest.onRoundStart(); });

    let error: any;
    await act(async () => {
      try {
        await latest.onGameEnd(100);
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeDefined();
    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);
    expect(mockWink.submitFinalScore).toHaveBeenCalledWith(expect.objectContaining({ score: 100 }));
    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    // the round should remain active
    expect(latest.activeRoundRef.current).toBe(mockRound);

    // retry with different score
    mockWink.completeRound = vi.fn();
    await act(async () => {
      await latest.onGameEnd(200);
    });

    // submit should not be called again
    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);
    // complete should be called again
    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    expect(latest.activeRoundRef.current).toBeNull();
    
    await mounted.unmount();
  });

  it('submit fail + complete pass → retry only submit', async () => {
    mockWink.submitFinalScore = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    
    const mounted = await mountProbe(mockWink, (v) => { latest = v; });
    
    await act(async () => { latest.onRoundStart(); });

    let error: any;
    await act(async () => {
      try {
        await latest.onGameEnd(100);
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeDefined();
    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);
    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    // the round should remain active
    expect(latest.activeRoundRef.current).toBe(mockRound);

    // retry
    mockWink.submitFinalScore = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      await latest.onGameEnd(200);
    });

    // submit should be called again
    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);
    expect(mockWink.submitFinalScore).toHaveBeenCalledWith(expect.objectContaining({ score: 100 }));
    // complete should not be called again
    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    expect(latest.activeRoundRef.current).toBeNull();
    
    await mounted.unmount();
  });

  it('concurrent calls → share same Promise', async () => {
    let resolveSubmit: any;
    mockWink.submitFinalScore = vi.fn(() => new Promise((resolve) => {
      resolveSubmit = resolve;
    }));

    const mounted = await mountProbe(mockWink, (v) => { latest = v; });
    
    await act(async () => { latest.onRoundStart(); });

    let p1: any, p2: any;
    await act(async () => {
      p1 = latest.onGameEnd(100);
      p2 = latest.onGameEnd(100);
    });

    expect(p1).toBe(p2);
    expect(mockWink.submitFinalScore).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit();
      await p1;
    });

    expect(mockWink.completeRound).toHaveBeenCalledTimes(1);
    
    await mounted.unmount();
  });
});
