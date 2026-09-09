---
name: game-audio-mastering
description: Audio architecture, gain staging, and dynamic range mastering for web games using the Web Audio API. Use when designing, debugging, optimizing, or balancing in-game sound to boost volume (+100%), prevent digital clipping/distortion when multiple SFX overlap, implement a master limiter bus (DynamicsCompressorNode), establish clean gain staging (BGM vs UI vs SFX vs Climax), or fix mobile/desktop audio inconsistencies and unlock/resumption lifecycles.
---

# Game Audio Mastering (Web Audio API)

Standard architecture and procedures for mastering web game audio. Ensures punchy, uniform loudness (+100% boost) across all devices while preventing digital clipping and distortion when multiple sound effects overlap.

---

## 1. Core Architecture (Master Bus & Limiter)

Never connect sound sources directly to `AudioContext.destination`. Route all audio through category sub-buses, a master gain bus, and a native master limiter (`DynamicsCompressorNode`).

```
[Audio Sources]
  ├── BGM (Music)  ───────> [BgmGainNode]  ─────┐
  ├── UI SFX (Clicks) ────> [UiGainNode]   ─────┼──> [MasterGainNode] ──> [MasterLimiter (Compressor)] ──> [destination]
  ├── Action SFX ─────────> [SfxGainNode]  ─────┤
  └── Climax / Burst ─────> [BurstGainNode] ────┘
```

### Why Native `DynamicsCompressorNode`?
When intense gameplay occurs (e.g., combos, explosions, simultaneous clears):
- BGM + Climax Sample + Noise Burst + Polyphonic Synth Tones fire within the same 50ms window.
- The raw mathematical sum of amplitudes exceeds `1.0` (0 dBFS digital ceiling).
- Without a master limiter, browsers clamp values strictly between `-1.0` and `+1.0`, resulting in harsh square-wave distortion (speaker crackle / rè tiếng).
- The `DynamicsCompressorNode` reacts in milliseconds, pulling down peaks transparently and restoring headroom instantly.

---

## 2. Standard Limiter Configuration

Configure the native `DynamicsCompressorNode` as a brick-wall limiter:

```typescript
const limiter = context.createDynamicsCompressor();

// Ceiling: clamp down peaks reaching near digital full scale
limiter.threshold.setValueAtTime(-3.0, context.currentTime); // -3 dBFS ceiling

// Knee: slight curve to avoid abrupt pumping artifacts
limiter.knee.setValueAtTime(4.0, context.currentTime);

// Ratio: maximum ratio (20:1) to function strictly as a limiter
limiter.ratio.setValueAtTime(20.0, context.currentTime);

// Attack: ultra-fast (3ms) to catch sudden transients immediately
limiter.attack.setValueAtTime(0.003, context.currentTime);

// Release: fast recovery (100ms - 150ms) so following sounds aren't dulled
limiter.release.setValueAtTime(0.12, context.currentTime);
```

---

## 3. Gain Staging Hierarchy (Tỉ lệ vàng âm thanh)

Do not rely on the compressor to fix an unbalanced mix. Balance sound sources at their origin using proper gain staging:

| Sound Category | Target Loudness | Typical Linear Gain | Role & Characteristics |
|---|---|---|---|
| **BGM (Music)** | `-18 dB` to `-14 dB` | `0.12 – 0.20` | Subtle, continuous background. Must never mask gameplay cues. |
| **UI Interaction** | `-14 dB` to `-10 dB` | `0.20 – 0.32` | Snappy, tactile feedback for buttons and drag/drop pickup. |
| **Routine Gameplay** | `-10 dB` to `-6 dB` | `0.32 – 0.50` | Block placement, valid moves, minor score ticks. Warm & punchy. |
| **Climax / Burst** | `-4 dB` to `-1 dB` | `0.65 – 0.90` | Line clears, full sweep boom, big combos, game over. Dominates mix. |

### Formula for Decibels to Linear Gain:
$$\text{Linear Gain} = 10^{\frac{\text{dB}}{20}}$$

- $0\text{ dB} = 1.0$
- $-3\text{ dB} \approx 0.708$
- $-6\text{ dB} \approx 0.501$
- $-12\text{ dB} \approx 0.251$
- $-18\text{ dB} \approx 0.126$

---

## 4. Procedures for Boosting Audio Volume (+100%)

When a user asks to "tăng âm lượng 100%" (double perceived loudness):

1. **Do NOT blindly multiply individual `v * 2`** or hard-clamp values with `Math.min(1, v)`. Hard clamping individual nodes causes louder sounds to hit the ceiling early while quieter sounds overtake them, ruining relative dynamics.
2. **Step 1 — Normalize Source Gains:**
   - Calibrate BGM to `~0.15` (both desktop and mobile).
   - Calibrate UI clicks to `~0.25`.
   - Calibrate routine gameplay sounds to `~0.35 - 0.45`.
   - Calibrate climax/burst sounds to `~0.80 - 0.90`.
3. **Step 2 — Insert Master Limiter Node:**
   - Create `masterCompressor` with settings from Section 2.
   - Route `masterBgmGain` and `masterSfxGain` into `masterCompressor`.
   - Route `masterCompressor` into `context.destination`.
4. **Step 3 — Apply Master Make-up Boost:**
   - If overall game volume is still too quiet, adjust `masterGain.gain.value` up to `1.2 – 1.4`. The master limiter will protect against distortion.

---

## 5. Web Audio Lifecycle & Mobile Best Practices

### A. Gesture Unlock (iOS / Safari / Chrome Autoplay Policy)
Always unlock on the first trusted user gesture (`pointerdown`, `touchstart`, `keydown`):
```typescript
async unlockFromGesture() {
  const context = this.ensureContext();
  if (!context) return false;

  if (context.state === "suspended") {
    await context.resume();
  }

  // Silent oscillator burst to force Safari audio engine awake
  try {
    const osc = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + 0.001);
  } catch {}

  return context.state === "running";
}
```

### B. Backgrounding (`visibilitychange`)
When tab is hidden (`document.hidden`), mute BGM gain or pause elements to avoid audio playing in the background or desyncing.

### C. Buffer Preloading vs Audio Elements
- Use `fetch() + context.decodeAudioData()` for short, latency-critical SFX (slashes, clicks, impacts).
- Use `HTMLAudioElement` routed via `context.createMediaElementSource()` for long streaming BGM to save memory.

---

## 6. Verification Checklist

- [ ] **No Digital Clipping:** Trigger the heaviest combo (3+ lines clear + combo sound + boom + music) and verify 0 crackle/rè.
- [ ] **Balance / Uniformity:** BGM does not overpower UI clicks; climax sound is clearly louder than routine block placement.
- [ ] **Mobile & Desktop Parity:** Sound perceived loudness is consistent across desktop browser and mobile touch screen.
- [ ] **Mute Integrity:** Setting SFX or BGM to disabled sets respective bus gain to 0 cleanly without residual leaks.
