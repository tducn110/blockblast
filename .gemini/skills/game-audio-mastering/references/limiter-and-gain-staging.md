# Web Audio Limiter and Gain Staging Reference

Deep technical reference for implementing professional, clipping-free audio in HTML5 / Web Audio games.

---

## 1. Web Audio Math & Psychoacoustics

### A. Decibels vs Linear Amplitude
Web Audio `GainNode.gain.value` operates in linear amplitude units ($0.0$ to $1.0$ and above).
Audio decibels (dBFS) relate to linear gain by:

$$\text{Gain} = 10^{\frac{\text{dB}}{20}}$$
$$\text{dB} = 20 \times \log_{10}(\text{Gain})$$

| dBFS | Linear Gain | Perceived Loudness | Usage in Games |
|---|---|---|---|
| $0\text{ dB}$ | $1.000$ | Full digital scale (clip boundary) | Absolute ceiling |
| $-1\text{ dB}$ | $0.891$ | Max safe single transient | Loudest impact peak |
| $-3\text{ dB}$ | $0.708$ | Half power | Primary SFX burst / Combo |
| $-6\text{ dB}$ | $0.501$ | Standard mixing level | Routine gameplay sounds |
| $-12\text{ dB}$ | $0.251$ | Half perceived volume of -6dB | UI Clicks, subtle ticks |
| $-18\text{ dB}$ | $0.126$ | Background bed | Ambient music (BGM) |

### B. Polyphonic Summation Problem
When multiple sounds play concurrently, their waveforms add together linearly:

$$A_{\text{sum}}(t) = A_1(t) + A_2(t) + \dots + A_n(t)$$

- In BlockBlast or puzzle games, when a combo triggers:
  - BGM ($0.15$) + Slash Buffer ($0.85$) + Noise Burst ($0.35$) + 3 Synth Tones ($3 \times 0.20 = 0.60$)
  - Worst-case instantaneous sum = $0.15 + 0.85 + 0.35 + 0.60 = 1.95$
- At $1.95$, the browser truncates any sample $> 1.0$ to $1.0$ (hard digital clipping).
- A **Master Limiter** prevents this truncation by applying an automatic gain reduction factor:
  $$A_{\text{out}}(t) = A_{\text{sum}}(t) \times g(t) \le \text{Threshold}$$

### C. Fletcher-Munson Perceived Loudness
Human hearing is non-linear across frequencies:
- The human ear is most sensitive between **$1\text{ kHz}$ and $4\text{ kHz}$**.
- A pure sine wave or triangle wave at $880\text{ Hz}$ or $1046\text{ Hz}$ with linear gain $0.20$ sounds **as loud** as a low-frequency rumble ($100\text{ Hz}$) or broad noise burst at linear gain $0.50$.
- **Rule of thumb:** Keep high-frequency synth tones ($> 600\text{ Hz}$) at $0.15 - 0.25$ max gain, while bass rumbles and broadband impacts can sit at $0.35 - 0.60$.

---

## 2. Production Master Bus Implementation Template

```typescript
export class GameAudioMasterBus {
  private context: AudioContext;
  readonly masterGain: GainNode;
  readonly bgmGain: GainNode;
  readonly sfxGain: GainNode;
  readonly limiter: DynamicsCompressorNode;

  constructor(context: AudioContext) {
    this.context = context;

    // 1. Create sub-buses
    this.bgmGain = context.createGain();
    this.sfxGain = context.createGain();
    this.masterGain = context.createGain();

    // 2. Create master limiter (brick-wall emulation)
    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-3.0, context.currentTime);
    this.limiter.knee.setValueAtTime(4.0, context.currentTime);
    this.limiter.ratio.setValueAtTime(20.0, context.currentTime);
    this.limiter.attack.setValueAtTime(0.003, context.currentTime);
    this.limiter.release.setValueAtTime(0.12, context.currentTime);

    // 3. Connect routing chain
    // Sources -> sub-buses -> masterGain -> limiter -> destination
    this.bgmGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(context.destination);

    // 4. Default gain staging
    this.bgmGain.gain.value = 0.16;   // ~ -16 dBFS
    this.sfxGain.gain.value = 1.0;    // SFX sub-bus unity
    this.masterGain.gain.value = 1.0; // Master unity
  }

  setMasterVolume(volume: number) {
    this.masterGain.gain.setValueAtTime(Math.max(0, volume), this.context.currentTime);
  }

  setBgmVolume(volume: number) {
    this.bgmGain.gain.setValueAtTime(Math.max(0, volume), this.context.currentTime);
  }

  setSfxVolume(volume: number) {
    this.sfxGain.gain.setValueAtTime(Math.max(0, volume), this.context.currentTime);
  }
}
```
