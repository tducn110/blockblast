# Block Blast

Block Blast is a Vite/PixiJS mini-game using the Wink SDK v1 contract.

## Wink integration

The canonical SDK is loaded before `/src/main.tsx`:

```html
<script src="https://sdk.winkgames.fun/v1/wink.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

`src/integrations/wink/useWinkIntegration.ts` is the only platform adapter.
It handles host lifecycle/mute/locale events, capability-gated leaderboard and
personal-best reads, and final score submission. The Dashboard renders the
remote Wink leaderboard in Wink runtime and only uses local stats in explicit
standalone mode.

No custom tracking, credentials, direct Wink HTTP, copied bridge, runtime
config, or custom messaging protocol is part of this repository.

## Local checks

```bash
npm run typecheck
npm test
npm run build
```

The output is the static `dist/` directory. `wink.game.json` is the source of
truth for the platform build profile.
