Đây là bản tổng hợp đầy đủ để m đưa thẳng cho agent sửa.

# BÁO CÁO AUDIT WINK INTEGRATION — BLOCKBLAST

## 1. Kết luận hiện tại

Integration Wink của BlockBlast **chưa đúng chuẩn và chưa đủ điều kiện handoff**.

Một số phần nền tảng đã có:

* Có `wink-bridge.js`.
* Checksum bridge khớp lock file.
* Có typed client và React hook.
* Có unit/security test.
* Không thấy adapter tự gọi Wink API bằng `fetch`.
* Không thấy adapter lưu token vào localStorage, sessionStorage hoặc cookie.

Tuy nhiên, bridge hiện không được load vào trang, runtime config sai schema, round ID sai định dạng và lifecycle chưa nối đúng vào gameplay. Vì vậy game có thể chạy giao diện bình thường nhưng **Wink submit score và complete round không hoạt động đúng**.

Trạng thái tổng quát:

```text
Bridge artifact/checksum:            PASS
Typed adapter structure:             CÓ
Authority boundary:                  CÓ VẺ ĐÚNG

Bridge boot trong index.html:         FAIL
Runtime config:                       FAIL
Handoff verifier:                     FAIL
Round ID:                             FAIL
Round lifecycle:                      FAIL
Score/x2 lifecycle:                   FAIL
Wink leaderboard:                     CHƯA TÍCH HỢP
Host pause behavior:                  FAIL
Audio pause behavior:                 FAIL
Production handoff scripts:           THIẾU
Track B 13/13:                        CHƯA THỂ PASS
```

---

# 2. BLOCKER NGHIÊM TRỌNG — P0

## P0.1 — `wink-bridge.js` không được load trong `index.html`

File:

```text
index.html
```

Hiện tại chỉ có:

```html
<script type="module" src="/src/main.tsx"></script>
```

Thiếu bridge:

```html
<script src="/wink-bridge.js"></script>
```

Thứ tự đúng phải là:

```html
<script src="/wink-bridge.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

Bridge phải được load trước React app.

### Hậu quả

Khi `useWinkIntegration()` khởi tạo:

```ts
window.WinkBridge
```

chưa tồn tại.

Client sẽ rơi vào:

```text
BRIDGE_MISSING
```

Game vẫn có thể hiển thị giao diện, nhưng:

* Không tạo được Wink connection.
* Không lấy được capabilities.
* Không lấy được leaderboard.
* Không submit được score.
* Không complete được round.
* Không nhận pause, resume, mute, unmute từ parent.

---

## P0.2 — `wink-runtime-config.json` sai schema

File:

```text
public/wink-runtime-config.json
```

Hiện tại:

```json
{
  "gameId": "70735b2e-8005-40e9-81ff-1c53e2a6ec01",
  "slug": "bo-lac-block-blaster-pixijs",
  "url": "https://dev-bo-lac-block-blaster-pixijs.papastudio.net",
  "origins": [
    "https://dev-bo-lac-block-blaster-pixijs.papastudio.net",
    "http://127.0.0.1:5173"
  ]
}
```

Schema này không đúng Wink runtime contract.

Runtime config chuẩn cần đúng 5 key:

```json
{
  "gameId": "70735b2e-8005-40e9-81ff-1c53e2a6ec01",
  "environment": "dev",
  "protocolVersion": 1,
  "bridgeVersion": "9.0.0",
  "allowedParentOrigins": [
    "https://dev-winkgames.papastudio.net",
    "http://127.0.0.1:8787"
  ]
}
```

### Những lỗi cụ thể

Thiếu:

```text
environment
protocolVersion
bridgeVersion
allowedParentOrigins
```

Có các key không thuộc schema:

```text
slug
url
origins
```

`origins` hiện chứa game origin và Vite origin. Đây là dữ liệu gần với catalog `allowedOrigins`, không phải parent origins của bridge.

Parent origins phải là:

```text
Wink dev parent
Harness parent
```

### Hậu quả

* Bridge không validate được runtime config.
* Session handshake không thành công.
* Handoff manifest và runtime config không khớp.
* Official verifier trả `WINK_HANDOFF_INVALID`.

Runtime config phải được sinh bằng script của starter kit, không nên viết tay.

---

## P0.3 — Round ID được tạo sai định dạng

File:

```text
src/app/App.tsx
```

Code hiện tại:

```ts
const id =
  `round-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
```

Kết quả dạng:

```text
round-19873abc-95af1203
```

Nhưng `client.ts` chỉ chấp nhận UUID RFC 4122:

```ts
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

### Hậu quả

`completeRound()` chắc chắn bị:

```text
INVALID_ROUND
```

Round ID còn được truyền vào metadata khi submit score. Client sử dụng round ID để idempotency, nên ID sai làm lifecycle không đáng tin cậy.

### Cách đúng

```ts
const roundId = crypto.randomUUID();
```

Nên đóng gói thành:

```ts
function createRoundId(): string {
  return crypto.randomUUID();
}
```

---

## P0.4 — Round start chưa nối với gameplay thật

Manifest nói:

```text
Round bắt đầu tại first tile move.
```

Nhưng code hiện tại gọi `onRoundStart()` khi bấm Play từ Dashboard:

```tsx
<DashboardScreen
  onPlay={() => {
    onRoundStart();
    setScreen("game");
  }}
/>
```

Trong khi app lại mặc định mở thẳng game:

```ts
const [screen, setScreen] = useState<Screen>("game");
```

### Hậu quả

Người chơi mở app và chơi trực tiếp mà:

```text
activeRoundId === null
```

Khi game over:

```ts
if (!roundId) return;
```

Game sẽ bỏ qua toàn bộ:

* Submit score.
* Complete round.
* Error reporting.

### Semantics đúng cho BlockBlast

Round chỉ nên bắt đầu khi:

```text
Người chơi đặt thành công block đầu tiên lên board.
```

Không start round khi:

* App mount.
* Audio unlock.
* Mở Dashboard.
* Chọn block nhưng chưa đặt.
* Drag sai vị trí.
* Thao tác không làm board thay đổi.

`useBlockBlastGame` hoặc callback `onPlacePieceSuccess` phải báo về `App` khi placement đầu tiên hợp lệ.

---

## P0.5 — Restart không quản lý Wink round

Có hai nút restart:

```text
Nút RotateCcw trong HUD
Nút “Chơi lại” trên result screen
```

Cả hai đều gọi trực tiếp:

```ts
game.resetGame()
```

Chúng không:

* Complete hoặc abandon round đang chạy.
* Submit score theo semantics đã chọn.
* Clear Wink round bằng một state machine rõ ràng.
* Tạo round mới đúng lúc.
* Reset `roundStartMs`.
* Bảo vệ khỏi duplicate restart.

### Trường hợp lỗi

Người chơi:

```text
đặt block đầu tiên
→ round đang active
→ bấm Restart
→ board reset
```

Nhưng Wink round cũ có thể vẫn treo.

Nếu game mới bắt đầu mà `activeRoundId` vẫn giữ ID cũ, hai game logic khác nhau có thể dùng chung một round.

### Cần có flow riêng

```ts
handleRestart()
```

Flow cần xác định:

```text
Nếu round đã bắt đầu:
  finalize/abandon round cũ đúng một lần
  clear round cũ
reset board
không tạo round mới ngay
đợi first valid placement mới tạo round mới
```

---

## P0.6 — Score x2 xảy ra sau khi score đã được submit

Game over flow hiện tại:

```text
onGameOver
→ onGameEnd(result.score)
→ submitFinalScore(score gốc)
→ completeRound()
→ hiện result overlay
→ người chơi mới có thể bấm x2
```

Nút x2 chỉ cập nhật local score:

```ts
const doubledScore = game.score * 2;

scoreData.updateLatestGameResult({
  score: doubledScore,
  ...
});

game.doubleScore();
```

Nó không gọi lại Wink submit vì round đã được clear:

```ts
setActiveRoundId(null);
```

### Hậu quả

```text
UI hiển thị score x2
Local storage lưu score x2
Wink leaderboard giữ score gốc
```

Kết quả trên Wink và trong game không khớp nhau.

### Manifest cũng đang mâu thuẫn

Manifest nói:

```text
Final score có thể được x2.
Score được submit khi round complete.
Score là explicit action độc lập.
```

Code không làm như vậy.

### Phải chọn một trong hai semantics

#### Phương án A — x2 được tính vào Wink score

```text
Game over
→ hiện result decision
→ người chơi chọn x2 hoặc bỏ qua
→ chốt final score
→ submitFinalScore()
→ completeRound()
```

#### Phương án B — Wink chỉ nhận score gốc

```text
Game over
→ submit score gốc
→ complete
→ x2 chỉ là local bonus và không xuất hiện như final Wink score
```

Phải sửa cả code, UI và `wink-integration.json` cho cùng một nghĩa.

---

# 3. LỖI RUNTIME VÀ GAMEPLAY — P1

## P1.1 — Wink leaderboard chưa được nối vào UI

Hook có:

```ts
wink.refreshLeaderboard()
wink.leaderboard
```

Nhưng app không có call site thực tế sử dụng chúng.

UI đang dùng:

```ts
buildLeaderboardModel(scoreData.stats, "Người chơi")
```

Đây là dữ liệu local từ `useScoreData`, không phải leaderboard Wink.

### Hậu quả

Các Track B scenario sau không thể pass:

```text
Anonymous leaderboard
Authenticated leaderboard
Submit score rồi refresh thấy score mới
```

### Cần sửa

Dashboard/result screen phải:

```text
Khi mở leaderboard:
  gọi wink.refreshLeaderboard()
  hiển thị loading/error/entries
  render wink.leaderboard
```

Local stats có thể hiển thị riêng, nhưng không được gọi nó là Wink leaderboard.

---

## P1.2 — Host pause chỉ dừng Pixi ticker, chưa khóa pointer input

`App.tsx` truyền:

```tsx
paused={screen !== "game" || wink.hostPaused}
```

Nhưng trong `Game.tsx`:

```tsx
<PixiBlockBlastCanvas
  paused={paused}
  interactionLocked={game.adPending}
/>
```

`interactionLocked` không chứa `paused`.

`PixiBlockBlastCanvas` chỉ thực hiện:

```ts
if (paused) {
  appRef.current.ticker.stop();
}
```

Trong khi pointer handlers kiểm tra:

```ts
interactionLocked
status === "playing"
```

### Hậu quả

Khi Wink parent pause:

* Animation ticker dừng.
* Nhưng người chơi vẫn có thể click, drag hoặc drop block.
* Board có thể thay đổi khi host đang pause.
* Round không thực sự frozen.

### Sửa tối thiểu

```tsx
interactionLocked={paused || game.adPending}
```

Ngoài UI lock, controller `useBlockBlastGame` cũng nên nhận `inputEnabled` hoặc `hostPaused` để chặn action ở business logic.

Không nên chỉ tin vào lớp render.

---

## P1.3 — React timers và async gameplay vẫn chạy khi pause

Game sử dụng nhiều cơ chế ngoài Pixi ticker:

```text
setTimeout
requestAnimationFrame
feedback timers
placement animation timers
clear animation timers
deferred tray generation
mock ad timers
scenery timer
```

Host pause hiện chỉ gọi:

```ts
app.ticker.stop()
```

### Hậu quả

Trong lúc pause:

* Tray mới vẫn có thể được generate.
* Game-over check có thể tiếp tục chạy.
* Feedback và animation state có thể tự clear.
* Mock ad có thể tự hoàn tất.
* Scenery effect vẫn hết hạn.
* React state vẫn thay đổi.

Manifest nói:

```text
board state được giữ nguyên, không time jump
```

Nhưng code hiện tại chưa bảo đảm điều này.

Cần một pause controller thống nhất hoặc clock/timer abstraction có khả năng:

```text
pause
resume
cancel on reset
ignore stale callbacks bằng run ID
```

---

## P1.4 — AudioContext không được suspend/resume khi host pause

Manifest nói:

```text
On pause AudioContext is suspended.
On resume AudioContext is resumed.
```

Nhưng `App.tsx` không gọi:

```ts
blockBlastAudio.suspend()
blockBlastAudio.resume()
```

`blockBlastAudio` cũng chưa expose public lifecycle methods tương ứng.

### Hậu quả

* BGM có thể tiếp tục trong lúc host pause.
* Scheduled Web Audio sounds có thể tiếp tục.
* Runtime behavior không khớp manifest.
* Track B pause/resume chưa thể pass đúng nghĩa.

Cần thêm:

```ts
async suspend(): Promise<void>
async resume(): Promise<void>
```

và gọi theo `wink.hostPaused`.

---

## P1.5 — Parent mute đang bị trộn với user preference tại audio engine

Code hiện tại:

```ts
blockBlastAudio.setMusicEnabled(
  musicEnabled && !wink.parentMuted
);

blockBlastAudio.setSfxEnabled(
  sfxEnabled && !wink.parentMuted
);
```

React state `musicEnabled` và `sfxEnabled` không bị thay đổi, đây là điểm đúng.

Tuy nhiên, audio engine lại sử dụng cùng method:

```text
setMusicEnabled
setSfxEnabled
```

cho cả:

* User preference.
* Effective parent mute.

Điều này làm audio engine không phân biệt rõ:

```text
userMuted
parentMuted
effectiveMuted
```

### Rủi ro

* Parent mute có thể remove unlock/visibility listeners như khi user chủ động tắt nhạc.
* Resume/unmute phụ thuộc effect chạy lại đúng lúc.
* Audio state nội bộ không phản ánh đúng nguồn mute.

### Kiến trúc nên dùng

```ts
setUserMusicEnabled(value)
setUserSfxEnabled(value)
setParentMuted(value)

effectiveMusicEnabled =
  userMusicEnabled && !parentMuted

effectiveSfxEnabled =
  userSfxEnabled && !parentMuted
```

---

## P1.6 — Các lỗi bridge quan trọng không được hiển thị

App chỉ render alert khi:

```ts
wink.error.code === "CAPABILITY_DENIED"
```

Các lỗi khác không được hiển thị:

```text
PARENT_REQUIRED
BRIDGE_MISSING
RUNTIME_CONFIG_INVALID
PROTOCOL_MISMATCH
SESSION_CREATE_FAILED
SESSION_EXPIRED
API_NETWORK_ERROR
```

### Hậu quả

Game có thể tiếp tục chạy như standalone trong khi Wink integration đã chết.

README nói game hoạt động exclusively inside Wink iframe, nhưng UI không enforce hoặc báo lỗi rõ ràng.

Cần có integration status UI hoặc fail-safe:

```text
connecting
ready anonymous
ready authenticated
fatal configuration error
retryable network error
```

---

# 4. LỖI TEST VÀ COPY-PASTE — P1

## P1.7 — Test vẫn dùng Game ID của project 2048

BlockBlast Game ID:

```text
70735b2e-8005-40e9-81ff-1c53e2a6ec01
```

Nhưng nhiều test vẫn dùng:

```text
27d74846-b8ca-44b1-87fe-a909d8b9eef9
```

Đây là ID của project 2048.

Các file bị ảnh hưởng:

```text
src/integrations/wink/__tests__/client.test.ts
src/integrations/wink/__tests__/security-negative.test.ts
src/integrations/wink/__tests__/useWinkIntegration.test.tsx
```

### Hậu quả

Test có thể xanh nhưng không validate đúng BlockBlast runtime contract.

Test phải dùng cùng Game ID với:

```text
wink-integration.json
wink-runtime-config.json
game.config.sh
catalog row
```

---

## P1.8 — Comments và descriptions vẫn ghi “2048”

Các file vẫn có nội dung:

```text
Typed Wink game client for the 2048 game
connects the 2048 game to the Wink platform bridge
adapted for 2048 semantics
```

Các test suite cũng ghi:

```text
createWinkGameClient (2048)
certified bridge security negatives — 2048
2048 iframe-only documentation boundary
```

Manifest còn ghi:

```text
first tile move
```

Trong BlockBlast, người chơi “place block”, không “move tile”.

### Hậu quả

Đây là bằng chứng integration được copy từ 2048/FruitSlashing nhưng chưa tailor hoàn chỉnh.

Nó cũng làm audit và bảo trì sau này dễ hiểu sai lifecycle.

---

## P1.9 — `verify:wink-bridge` là verifier giả

`package.json` hiện có:

```json
{
  "verify:wink-bridge": "npm test"
}
```

Đây không phải bridge verification.

Verifier đúng phải:

* Hash `public/wink-bridge.js`.
* So sánh với `wink-bridge.lock.json`.
* Kiểm tra bridge version.
* Kiểm tra artifact không bị sửa.
* In output dạng `wink bridge verified …`.

### Hậu quả

Lệnh:

```bash
npm run verify:wink-bridge
```

có thể xanh chỉ vì unit tests xanh, ngay cả khi bridge artifact bị sai hoặc thiếu.

Phải dùng script chính thức:

```text
scripts/verify-wink-bridge.mjs
```

---

## P1.10 — Thiếu các scripts kiểm tra config

Repo chưa có đầy đủ:

```text
scripts/generate-wink-runtime-config.mjs
scripts/verify-wink-bridge.mjs
scripts/verify-game-config.mjs
scripts/verify-docker-headers.mjs
```

Thiếu các package scripts tương ứng:

```text
verify:wink-config
verify:wink-bridge
verify:game-config
verify:docker-headers
certify:c4
```

### Hậu quả

Không có cơ chế chống drift giữa:

```text
game.config.sh
wink-integration.json
wink-runtime-config.json
bridge lock
catalog configuration
```

---

## P1.11 — `wink-bridge.ts` là adapter thứ hai không được dùng

Repo có cả:

```text
src/integrations/wink/client.ts
src/integrations/wink/wink-bridge.ts
```

Nhưng `wink-bridge.ts` không có call site rõ ràng trong app và không nằm trong manifest adapter list.

### Rủi ro

* Hai lớp wrapper cho cùng bridge.
* Types và behavior có thể drift.
* Developer có thể import nhầm adapter.
* Security audit không biết lớp nào là authority chính.

Nên:

```text
giữ một adapter authority duy nhất
xóa file thừa hoặc biến nó thành type-only rõ ràng
```

---

# 5. MANIFEST KHÔNG KHỚP CODE — P1

## P1.12 — `roundId` semantics không đúng code

Manifest nói:

```text
Round bắt đầu tại first tile move.
```

Code lại start tại Dashboard Play.

App mặc định mở game, nên nhiều trường hợp không start round.

---

## P1.13 — `completion` semantics chưa hoàn toàn đúng

Manifest nói:

```text
Completion chỉ xảy ra khi người chơi decline revive.
```

Nhưng game còn có trường hợp:

```text
revive đã dùng
→ game over lần tiếp theo
→ onGameOver chạy tự động
```

Ngoài ra restart giữa ván chưa được định nghĩa đúng trong code.

Manifest phải mô tả đầy đủ:

```text
decline revive
game over sau khi đã revive
abandon/restart giữa round
```

---

## P1.14 — `score` semantics trái code

Manifest nói:

```text
Score có thể được x2 rồi mới submit.
```

Code submit score trước khi người chơi bấm x2.

---

## P1.15 — `pauseResume` semantics trái code

Manifest nói:

```text
input bị disable
AudioContext suspend
board không thay đổi
```

Code hiện chỉ stop Pixi ticker.

---

## P1.16 — `muteUnmute` mô tả mạnh hơn implementation

Manifest nói parent mute chỉ điều khiển output và không tác động preference.

React preference đúng là không đổi, nhưng audio engine vẫn dùng cùng `setMusicEnabled` và `setSfxEnabled` cho effective mute.

Cần sửa implementation hoặc sửa lại mô tả.

---

# 6. PRODUCTION HANDOFF CÒN THIẾU — P2

## P2.1 — Thiếu Docker/Nginx starter structure

Repo chưa thấy đầy đủ:

```text
Dockerfile
.dockerignore chuẩn Wink
etc/default.conf.template
scripts/verify-docker-headers.mjs
game.config.sh
```

Do đó chưa thể chạy gate:

```bash
npm run verify:docker-headers
```

Chưa xác nhận được:

```text
CSP frame-ancestors
Nginx SPA fallback
security headers
5/5 production routes
```

---

## P2.2 — Chưa có C4 certification structure

Chưa có bằng chứng repo chứa và chạy:

```text
scripts/certify-wink-c4.mjs
scripts/c4/
npm run certify:c4
```

Không nên tuyên bố đạt chuẩn FruitSlashing/C4 chỉ dựa trên typed adapter.

---

## P2.3 — Catalog row chưa được xác nhận

Cần kiểm tra hoặc tạo catalog row với:

```text
id: 70735b2e-8005-40e9-81ff-1c53e2a6ec01
slug: bo-lac-block-blaster-pixijs
protocolVersion: 1
bridgeVersion: 9.0.0
```

Allowed game origins dự kiến:

```text
https://dev-bo-lac-block-blaster-pixijs.papastudio.net
http://127.0.0.1:5173
```

Catalog row và runtime config phục vụ hai mục đích khác nhau:

```text
Catalog allowedOrigins:
  game origins

Runtime allowedParentOrigins:
  Wink parent + harness parent
```

Không được trộn hai danh sách.

---

## P2.4 — Track B runtime 13/13 chưa chạy

Unit tests không thay thế Track B.

Phải test thật:

```text
1. Top-level PARENT_REQUIRED
2. Anonymous ready
3. Anonymous leaderboard
4. Anonymous completion
5. Anonymous score denied
6. Authenticated ready
7. Authenticated leaderboard
8. Authenticated final score
9. Completion và score độc lập
10. Pause/resume
11. Mute/unmute
12. Negative protocol
13. Secret boundary
```

Với các lỗi hiện tại, nhiều scenario chắc chắn chưa thể pass.

---

## P2.5 — Build/test chưa được chứng minh đầy đủ trong audit này

Cần chạy lại độc lập:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run verify:wink-bridge
npm run verify:wink-config
npm run certify:c4
git diff --check
```

Test xanh không đủ nếu:

* Test dùng Game ID cũ.
* Script verify chỉ alias sang `npm test`.
* Runtime bridge không được load.
* Gameplay không có call site đúng.

---

## P2.6 — Mock ads vẫn nằm trong production gameplay

Game đang dùng:

```ts
playMockAd()
```

cho:

```text
reserve unlock
revive
x2 score
```

Nếu đây chỉ là demo/dev behavior, cần:

* Tách rõ dev-only.
* Không để production giả lập reward.
* Không dùng mock flow làm căn cứ chứng nhận Wink lifecycle.

Mock ad đặc biệt ảnh hưởng trực tiếp thời điểm final score và completion.

---

## P2.7 — HTML metadata vẫn là placeholder

`index.html` còn:

```html
<title>Bắt đầu thiết kế</title>
```

Description:

```text
This web application streamlines project management...
```

Đây không phải metadata của BlockBlast.

Không phải blocker Wink, nhưng cho thấy project chưa được cleanup để handoff production.

---

# 7. SEMANTICS ĐỀ XUẤT CHO BLOCKBLAST

## Round start

```text
Tạo UUID khi block đầu tiên được đặt thành công và board thực sự thay đổi.
```

Không tạo round khi:

```text
mount app
audio unlock
mở Dashboard
select block
invalid placement
```

## Round continuity

Giữ nguyên round ID qua:

```text
pause/resume
mute/unmute
revive
mở settings
mở dashboard nếu gameplay được preserve
```

## Restart giữa ván

```text
Restart khi round đang active = abandon round cũ.
Finalize round cũ đúng một lần theo semantics đã thống nhất.
Reset board.
Không tạo round mới cho đến valid placement tiếp theo.
```

## Completion

Completion xảy ra đúng một lần khi:

```text
người chơi decline revive
game over lần cuối sau khi đã revive
người chơi abandon/restart một round đã bắt đầu
```

## Final score

Chọn rõ một flow:

```text
Score gốc
hoặc
Score sau x2
```

Nếu x2 thuộc final Wink score:

```text
game over
→ chờ x2/skip
→ chốt final score
→ submit
→ complete
```

## Independence

```text
submit thất bại không được chặn complete
complete thất bại không được chặn submit
```

Hai operation cần:

* `try/catch` riêng.
* Idempotency riêng.
* Cùng một valid UUID.
* Không duplicate khi callback chạy lại.

## Pause

Khi host pause:

```text
khóa toàn bộ input
dừng Pixi ticker
dừng hoặc freeze gameplay timers
dừng deferred tray generation
không hoàn tất mock reward
suspend AudioContext
giữ nguyên board và round ID
```

## Mute

Dùng ba state riêng:

```text
userMusicEnabled
userSfxEnabled
parentMuted
```

Effective output:

```text
musicOutput = userMusicEnabled && !parentMuted
sfxOutput = userSfxEnabled && !parentMuted
```

---

# 8. THỨ TỰ SỬA BẮT BUỘC

```text
1. Chạy Wink init-game/scaffolder đúng Game ID của BlockBlast.
2. Khôi phục toàn bộ starter scripts và Docker structure.
3. Sinh lại wink-runtime-config.json đúng schema.
4. Load /wink-bridge.js trước /src/main.tsx.
5. Thay round ID bằng crypto.randomUUID().
6. Nối round start vào first valid block placement.
7. Viết handleRestart để finalize round cũ đúng cách.
8. Chốt lại x2 → final score → submit → complete.
9. Nối Wink leaderboard vào Dashboard/result UI.
10. Khóa input và mọi gameplay timer khi host pause.
11. Thêm AudioContext suspend/resume.
12. Tách parent mute khỏi user preferences.
13. Sửa toàn bộ ID/comment/test từ 2048 sang BlockBlast.
14. Xóa hoặc hợp nhất wrapper wink-bridge.ts bị trùng.
15. Sửa verify:wink-bridge thành verifier artifact thật.
16. Tailor wink-integration.json theo code thực tế.
17. Chạy unit/typecheck/build/static handoff.
18. Chạy Docker headers 5/5.
19. Tạo/verify catalog row.
20. Chạy Track B runtime 13/13.
```

---

# 9. DEFINITION OF DONE

Chỉ được báo BlockBlast integration hoàn thành khi đủ:

```text
[ ] index.html load wink-bridge.js trước main.tsx
[ ] runtime config đúng 5 key
[ ] runtime config được generate, không viết tay
[ ] bridge checksum verifier pass
[ ] round ID là UUID hợp lệ
[ ] first valid placement tạo round
[ ] invalid placement không tạo round
[ ] revive giữ nguyên round ID
[ ] restart finalize round cũ đúng một lần
[ ] x2 score khớp score gửi Wink
[ ] submit và complete độc lập
[ ] không duplicate submit/complete
[ ] Wink leaderboard được render thật
[ ] host pause khóa input
[ ] host pause freeze timers
[ ] host pause suspend audio
[ ] parent mute không đổi user preference
[ ] test dùng BlockBlast Game ID
[ ] không còn references “2048”
[ ] npm ci pass
[ ] npm test pass
[ ] npm run typecheck pass
[ ] npm run build pass
[ ] npm run verify:wink-bridge pass
[ ] verify-handoff trả WINK_HANDOFF_OK
[ ] npm run verify:docker-headers pass 5/5
[ ] catalog row tồn tại và ID khớp
[ ] Track B runtime pass 13/13
[ ] code đã push GitLab
```

## Trạng thái chính xác hiện tại

```text
BlockBlast UI/gameplay:                Có thể chạy độc lập
Wink source adapter:                   Có nhưng chưa nối đúng
Wink bridge runtime:                   Không boot đúng
Wink score/completion:                 Không hoạt động đáng tin cậy
Static handoff:                        Không đạt
Platform certification:               Chưa đạt
Production ready:                      Chưa
```

