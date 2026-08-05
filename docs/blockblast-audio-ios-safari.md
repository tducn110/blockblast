# Block Blast audio: iOS Safari unlock fix

Related commit: [`0f17f0b`](https://github.com/tducn110/blockblast/commit/0f17f0bc40be2df108483b61794319da4b1832c2) (`Update blockblast app and audio`)

## Problem

On iOS Safari, audio did not start reliably on load.
The first user action could unlock audio in theory, but in practice the background music often stayed silent until a second interaction.
SFX also depended on the same unlock path, so the whole audio stack felt delayed.

## Root cause

Safari iOS is strict about autoplay.
Audio must be started from a real user gesture chain.

The original audio flow had two weak points:

- `App.tsx` attached global `pointerdown`, `touchstart`, and `keydown` listeners to unlock audio.
- `blockBlastAudio.ts` then resumed the `AudioContext` and started music through async paths.

That async boundary was the problem on iOS Safari:

- the gesture was already “spent” by the time `audio.play()` happened in some cases;
- the music promise could resolve too late for Safari’s autoplay policy;
- SFX helpers also waited on async context resume before scheduling sound.

## What was changed

The fix was to make the first gesture do the real work immediately:

- keep the global unlock listeners in `App.tsx`;
- call `blockBlastAudio.unlockFromGesture()` on the first pointer/touch/keyboard interaction;
- start the music track from the same gesture path;
- avoid delaying SFX scheduling behind a promise chain;
- keep music and SFX volume routing inside `blockBlastAudio.ts`.

## Result

After the fix:

- tapping any button or the first block interaction unlocks audio;
- background music can start on the first valid touch;
- SFX are available immediately after unlock;
- this is the best reliable behavior for iOS Safari, because true autoplay on load is still blocked by the browser.

## Files involved

- `src/app/App.tsx`
- `src/features/blockblast/audio/blockBlastAudio.ts`

## Verification

- production build passes with `npm run build`
- manual target: Safari iOS
- expected behavior: first valid user interaction unlocks both BGM and SFX
