Dưới đây là bản report sạch cho phần **UI checkpoint + P1/P2/P3**. Tóm tắt này dựa trên log chạy thực tế: đã commit riêng UI patch, P1 mascot, P2 race hardening, P3 pause ticker; `repomix-output.xml` vẫn modified ngoài scope và không được stage/commit. 

# Report — Block Blast UI & Runtime Hardening Checkpoint

Ngày: 29/06/2026

## Mục tiêu

Hoàn thiện các checkpoint sau khi core placement performance đã ổn định:

1. Polish UI desktop tray và side panel.
2. Sửa lỗi mascot asset flicker / missing asset.
3. Harden race condition quanh deferred tray generation.
4. Pause Pixi ticker khi game bị ẩn ở dashboard/settings.

Nguyên tắc chính:

```txt
Không đụng lại core placement nếu không có bug mới.
Không thay đổi scoring.
Không thay đổi combo/leaderboard behavior.
Không thay đổi createSmartPieces algorithm.
Không phá visual-first placement flow.
```

---

## Trạng thái trước khi làm

Working tree có sẵn:

```txt
M repomix-output.xml
M src/features/blockblast/components/Game.tsx
M src/features/blockblast/render/usePixiPieces.ts
```

Trong đó:

```txt
Game.tsx + usePixiPieces.ts = UI tray/desktop patch đã được duyệt.
repomix-output.xml = file modified sẵn ngoài scope, không đụng và không commit.
```

Agent đã commit riêng UI patch trước để P1/P2/P3 không bị lẫn thay đổi.

---

# Commit 1 — Desktop Tray & Side Panel Polish

Commit:

```txt
bd26e31 Polish desktop tray and side panel
```

## Files changed

```txt
src/features/blockblast/components/Game.tsx
src/features/blockblast/render/usePixiPieces.ts
```

## Nội dung thay đổi

### 1. Sửa tray preview overflow

Trước đó tray preview scale chủ yếu theo chiều rộng, khiến các piece dọc như `line4v` gần như chạm hoặc tràn selected slot border.

Đã đổi sang công thức fit theo cả width và height:

```txt
previewCell = max(minCell, min(maxCell, cellByWidth, cellByHeight))
```

Thông số hiện tại:

```txt
slotPaddingX = 16
slotPaddingY = 14
previewGap = 3
minCell = 14
maxCell = 22
```

Kết quả mong đợi:

```txt
- line4v có padding trên/dưới
- line4h có padding trái/phải
- single block vẫn centered
- square/L/T/Z pieces không sát viền
- selected border không còn cảm giác bóp nghẹt block
```

### 2. Làm selected tray slot mềm hơn

Thay vì border selected quá dày/gắt, selected slot hiện dùng:

```txt
- outer stroke nhẹ hơn
- inset fill/stroke tinh tế hơn
- vẫn đủ rõ selected state
```

### 3. Polish desktop side panel

Trong `Game.tsx`:

```txt
- left column giảm từ lg:w-[280px] xuống lg:w-[264px]
- giảm desktop vertical gaps
- gom mascot + HUD + instruction thành panel desktop nhẹ
- bỏ lg:mt-auto khiến instruction bị đẩy quá thấp
```

Mục tiêu là làm PC layout bớt rỗng nhưng không redesign mobile.

## Verification

```txt
corepack pnpm build: passed
git diff --check -- Game.tsx usePixiPieces.ts: passed
```

---

# Commit 2 — P1 Mascot Asset Fallback & Preload

Commit:

```txt
8371a5a Add mascot asset fallback and preload
```

## Files changed

```txt
src/features/blockblast/components/Mascot.tsx
```

## Vấn đề

`Mascot.tsx` dùng nhiều asset `.webp` hardcoded. Khi chuyển cảnh boom hoặc đổi `variantIndex`, nếu asset chưa load hoặc bị thiếu thì mascot có thể:

```txt
- chớp ảnh
- hiện broken image
- mất hình trong nháy mắt
```

## Nội dung thay đổi

### 1. Thêm fallback asset

Fallback:

```txt
/assets/optimized/peanut_static-180.webp
```

### 2. Thêm `img.onError`

Nếu asset hiện tại load fail, image tự fallback về peanut asset.

Logic có guard để tránh vòng lặp lỗi vô hạn:

```txt
nếu image đã là fallback thì không set lại nữa
```

### 3. Preload mascot assets

Trong `Mascot.tsx`, thêm effect preload:

```txt
MASCOT_ASSETS.map(src => new Image().src = src)
```

Không dùng state, không block render, không đụng game loop.

## Verification

```txt
corepack pnpm build: passed
git diff --check -- Mascot.tsx: passed
```

## Confirmed unchanged

```txt
Game.tsx không bị đụng trong P1.
Không đụng Pixi.
Không đụng placement flow.
Không đụng scoring/combo/leaderboard.
```

---

# Commit 3 — P2 Deferred Tray Generation Race Hardening

Commit:

```txt
cafeaa8 Harden deferred tray generation race
```

## Files changed

```txt
src/features/blockblast/hooks/useBlockBlastGame.ts
```

## Vấn đề

Sau khi đặt block thứ 3, `createSmartPieces` được defer sang `requestAnimationFrame` để tránh jank. Nhưng flow này tạo một khoảng trung gian:

```txt
place third piece
→ pieces đều marked placed
→ status vẫn cần chờ generate tray mới
→ rAF sau đó dispatch generateNextTray
```

Nếu user reset hoặc chuyển màn đúng lúc rAF chưa chạy, callback cũ có thể dispatch vào game run mới.

## Nội dung thay đổi

### 1. Thêm trạng thái `resolving`

Status chuyển từ:

```ts
"playing" | "gameOver"
```

sang:

```ts
"playing" | "resolving" | "gameOver"
```

Khi đặt block thứ 3:

```txt
playing
→ resolving
→ rAF generate tray
→ playing/gameOver
```

### 2. Thêm `generationRafRef`

Dùng để lưu requestAnimationFrame đang pending:

```txt
generationRafRef
```

Reset/unmount sẽ cancel rAF đang chờ.

### 3. Thêm `runIdRef`

Dùng để chống stale callback:

```txt
- capture runId trước khi schedule rAF
- khi rAF chạy, check capturedRunId === runIdRef.current
- nếu lệch thì return, không dispatch
```

Reset sẽ tăng `runIdRef`, nên callback cũ không thể hồi sinh tray cũ.

### 4. Khóa input khi không ở `playing`

Các action input sẽ no-op nếu status không phải `playing`:

```txt
selectPiece
startDrag
endDrag
setHoverAnchor
doPlace
```

Điều này tránh người chơi tương tác trong frame trung gian `resolving`.

### 5. Làm sạch `generateNextTray`

Trước đó game over sau generated tray phải dispatch vòng qua `placePiece` payload.

Sau fix:

```txt
generateNextTray nhận pieces + status
```

Nó có thể set trực tiếp:

```txt
status = playing
hoặc
status = gameOver
```

Giảm semantic sai kiểu “dùng placePiece để finish game”.

## Confirmed unchanged

```txt
createSmartPieces vẫn deferred.
Không đổi scoring.
Không đổi combo/maxCombo.
Không đổi leaderboard behavior.
Không đổi visual-first placement flow.
Không đụng usePixiPieces.ts trong P2.
```

## Verification

```txt
corepack pnpm build: passed
corepack pnpm vitest run: passed, 1 file / 5 tests
git diff --check -- useBlockBlastGame.ts: passed
```

---

# Commit 4 — P3 Pause Pixi Ticker When Game Is Hidden

Commit:

```txt
e80c77d Pause Pixi ticker when game is hidden
```

## Files changed

```txt
src/app/App.tsx
src/features/blockblast/components/Game.tsx
src/features/blockblast/components/PixiBlockBlastCanvas.tsx
```

## Vấn đề

App giữ `Game` mounted khi chuyển sang dashboard/settings để không mất tiến trình. UX này đúng, nhưng Pixi ticker có thể vẫn chạy dù game đang bị ẩn bằng `display: none`.

## Nội dung thay đổi

### 1. Thêm prop `paused`

Trong `App.tsx`:

```tsx
paused={screen !== "game"}
```

### 2. Truyền prop qua `Game.tsx`

`Game.tsx` nhận `paused` và forward xuống `PixiBlockBlastCanvas`.

### 3. Pause/resume ticker trong `PixiBlockBlastCanvas`

Khi paused:

```txt
app.ticker.stop()
```

Khi quay lại game:

```txt
app.ticker.start()
app.render()
```

Canvas không bị destroy, Pixi app không recreate, game state không reset.

### 4. Update type status

Do P2 đã thêm `"resolving"`, `PixiBlockBlastCanvas` status type được mở rộng:

```ts
"playing" | "resolving" | "gameOver"
```

## Confirmed unchanged

```txt
Không đụng usePixiPieces placement logic.
Không đụng useBlockBlastGame rules.
Không đụng createSmartPieces.
Không đổi scoring/combo/leaderboard.
Không đổi tray preview sizing.
Không reset game state khi chuyển màn.
```

## Verification

```txt
corepack pnpm build: passed
corepack pnpm vitest run: passed
git diff --check -- App.tsx Game.tsx PixiBlockBlastCanvas.tsx: passed
```

---

# Final Commit Log

```txt
e80c77d Pause Pixi ticker when game is hidden
cafeaa8 Harden deferred tray generation race
8371a5a Add mascot asset fallback and preload
bd26e31 Polish desktop tray and side panel
5fdcb77 fix: resolve placement visual jank and flicker, update report
```

---

# Final Working Tree State

Sau tất cả checkpoint:

```txt
M repomix-output.xml
```

`repomix-output.xml` là thay đổi ngoài scope, đã tồn tại sẵn và không được stage/commit.

Full `git diff --check` vẫn fail do trailing whitespace trong `repomix-output.xml`, nhưng scoped diff-check cho các file đã sửa đều pass.

---

# Build/Test Status

```txt
corepack pnpm build: passed
corepack pnpm vitest run: passed
scoped git diff --check: passed
```

Browser manual checks chưa được chạy trong terminal session.

---

# Manual QA cần chạy sau

## UI tray / PC layout

```txt
- open desktop 1920x1080
- check line4v top/bottom padding
- check line4h left/right padding
- check single centered
- check L/T/Z pieces không sát border
- selected slot rõ nhưng không gắt
```

## Mascot

```txt
- reload game
- trigger boom/clear effect
- confirm mascot không broken image
- switch dashboard/settings and back
- confirm mascot vẫn visible
```

## Race hardening

```txt
- place third block normally
- reset immediately after placing third block
- open dashboard/settings immediately after placing third block
- return to game
- confirm old tray generation không ghi đè state mới
```

## Pause ticker

```txt
- start game
- place some blocks
- open dashboard
- return game
- confirm board/tray/score preserved
- open settings
- return game
- confirm drag/drop still smooth
```

---

# Kết luận

Checkpoint này tốt và đã được tách commit sạch.

Trạng thái hiện tại:

```txt
GOOD:
- desktop tray overflow fixed
- desktop side panel less empty
- mascot fallback/preload added
- deferred tray generation race hardened
- resolving state added
- input locked during resolving
- stale rAF guarded by runId
- Pixi ticker pauses when game hidden
- placement performance flow preserved
- scoring/combo/leaderboard unchanged
```

Còn lại:

```txt
- repomix-output.xml modified ngoài scope
- manual browser QA chưa chạy
```

Quy tắc tiếp theo:

```txt
Không đụng core placement nữa.
Nếu có lỗi tiếp, xử lý theo layer:
1. UI visual
2. state-hardening
3. Pixi lifecycle
4. only then core logic if absolutely necessary
```
