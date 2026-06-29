# Mobile Ads / Reserve Slot Plan

## Current Decision

Keep rewarded-ad reserve UI on desktop only for now.

Mobile reserve slot work is intentionally paused because the tray is inside the Pixi canvas and needs a cleaner mobile-specific interaction design before implementation.

## Current PC Behavior

- Desktop has an ads/reserve panel outside the Pixi tray.
- The normal tray still generates exactly 3 pieces.
- The reserve slot is not a 4th generated piece.
- Watching the mock ad unlocks one reserve/storage slot.
- A selected normal piece can be stored in reserve.
- If reserve has a piece and a normal tray slot is empty/placed, reserve can be moved back into that tray slot.
- Scoring, combo, leaderboard, board size, and `createSmartPieces` stay unchanged.

## Mobile Product Goal

Mobile should eventually support:

- 3 normal generated pieces.
- 1 optional reserve slot unlocked by rewarded ad.
- No generator change.
- No scoring/combo change.
- No placement-performance regression.

## Preferred Mobile Direction

Use a single horizontal 4-slot tray:

```txt
[ piece 1 ] [ piece 2 ] [ piece 3 ] [ ad-locked reserve ]
```

Do not use a 2x2 tray unless one-row sizing fails in manual QA.

## Mobile Sizing Proposal

The mobile canvas width is currently `VIEW_WIDTH = 412`.

Proposed compact slot constants:

```txt
mobileSlotWidth: 82-88
mobileSlotHeight: 88-96
mobileSlotGap: 8
mobileTrayX: centered inside VIEW_WIDTH
previewMaxCell: 18-20
previewMinCell: 10-12
previewGap: 2
slotPaddingX: 8-10
slotPaddingY: 8-10
```

Fit formula must use both width and height:

```txt
availableWidth = mobileSlotWidth - slotPaddingX * 2
availableHeight = mobileSlotHeight - slotPaddingY * 2
cellByWidth = floor((availableWidth - widthGaps) / bounds.width)
cellByHeight = floor((availableHeight - heightGaps) / bounds.height)
previewCell = max(minCell, min(maxCell, cellByWidth, cellByHeight))
```

This is required so `line4v`, `line4h`, `square2`, and L/T/Z pieces do not touch slot borders.

## Mobile Locked Slot Visual

The reserve slot should look like a normal tray slot, not a separate card stuffed inside the slot.

Locked state:

- Same warm slot shell as normal tray.
- Subtle dim overlay.
- Small lock symbol.
- Small pill/button label: `Xem QC`.
- Avoid rendering large text blocks inside the slot.

Unlocked empty state:

- Same tray shell.
- Subtle plus sign or small `Cất` label.
- Distinct enough from normal empty/placed slots.

Occupied state:

- Render the stored piece with the exact same compact piece-preview renderer as normal tray pieces.
- Do not use custom HTML/mock visuals for stored pieces.

## Interaction Model

Case 1: reserve locked

- Tap slot 4.
- Trigger rewarded ad flow.
- For mock implementation, resolve success immediately through a replaceable async function.
- On success, set `reserveUnlocked = true`.
- On fail/cancel, keep locked.

Case 2: reserve unlocked and empty

- User selects a normal tray piece.
- Tap reserve slot.
- Move selected piece into reserve.
- Mark its normal tray slot unavailable/placed according to current architecture.
- Do not score.
- Do not count as board placement.

Case 3: reserve unlocked and occupied, no normal selected

- Tapping reserve should either select the reserve piece for placement or move it back to an empty normal tray slot.
- This needs UX decision before implementation.

Case 4: reserve unlocked and occupied, normal piece selected

- Tap reserve.
- Swap selected normal piece with reserve piece.
- Do not score.

## State Design

State fields:

```ts
reserveUnlocked: boolean;
reservePiece: BlockPiece | null;
```

Handlers:

```ts
unlockReserveSlot(): void;
useReserveSlot(): boolean;
```

The real ad SDK should replace only the mock reward function, not the game reducer.

## Implementation Notes

- Keep `createSmartPieces` unchanged.
- Keep generated tray count at 3.
- Add mobile-only reserve slot render in `usePixiPieces`.
- Keep desktop ads/reserve panel outside Pixi.
- Keep reserve actions no-op unless game status is `playing`.
- Preserve the existing resolving/rAF race guard.
- If reserve piece can be placed directly from slot 4, make sure `onPlacePiece` can resolve that piece id and clears `reservePiece` after placement.
- If reserve piece returns to tray instead, make sure it only fills a placed/empty tray slot and does not create a duplicate piece.

## QA Checklist

- Mobile width 390-430px shows one horizontal row with 4 slots.
- No tray overflow.
- Normal pieces still fit in compact slots.
- Locked reserve slot clearly advertises `Xem QC`.
- Unlock mock works.
- Store, swap, and retrieve/placement behavior does not duplicate pieces.
- Reserve persists across normal tray regeneration.
- Reset returns reserve to intended default.
- Desktop PC ads panel still works.
- Build and vitest pass.
- No placement jank returns.

