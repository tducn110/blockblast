# Wink SDK v1 integration

Block Blast uses the canonical SDK contract rather than a repository-owned
bridge. All Wink calls live in
`src/integrations/wink/useWinkIntegration.ts`.

## Entrypoint and lifecycle

```html
<script src="https://sdk.winkgames.fun/v1/wink.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

The adapter calls `window.Wink.init()` once and subscribes to pause/resume,
mute/unmute, and locale. It calls `gameplayStart()` at the first playable move,
calls `gameplayStop()` at final game-over, checks `can("submitScore")` before
submitting a final score, and refreshes the remote leaderboard after a
successful submit and when the Dashboard opens.

The Dashboard renders SDK leaderboard/personal-best output in Wink runtime.
Local stats are reserved for explicit standalone mode so they never silently
replace the platform leaderboard.

## Boundaries

Do not add custom tracking, direct Wink HTTP calls, tokens, game IDs, API URLs,
custom `postMessage`, a copied bridge, or generated runtime config. The
platform owns session, environment, domain, deployment, and promotion.

`wink.game.json` declares the v1 `wink-sdk` runtime, protocol 1, SDK major 1,
`vite-static-v1`, and `dist` output. The only root lockfile is
`package-lock.json` and the local validation commands are:

```bash
npm run typecheck
npm test
npm run build
```
