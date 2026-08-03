# Wink API Testing & Handoff Result

## 1. Mục Tiêu (Objective)
Đăng ký một game iframe ở môi trường dev, lấy UUID và cấu hình cho `blockblast` để game dev sử dụng như một bản reference đạt chuẩn (Wink Handoff Standard). Đảm bảo mọi script testing của Dev Kit đều pass và sẵn sàng nộp.

## 2. Kết Quả Test API (API Test Results)

Đã chạy script Node fetch tới hệ thống Admin API của Wink và ghi nhận kết quả:
- **Admin Login:** Thành công, lấy được `csrfToken` và `Cookies`.
- **Register Dev Catalog Row:** 
  - API endpoint: `POST /api/v1/admin/games`
  - Body truyền `slug: "block-blast"`.
  - Kết quả: `201 Created`
  - API trả về UUID chính thức trên hệ thống: `7784ef77-53f2-4924-9179-356c8e0a715f`
- **Verify Public Catalog:**
  - API endpoint: `GET /api/v1/games/slug/block-blast`
  - Kết quả: `200 OK`, game ID khớp chính xác với `7784ef77-53f2-4924-9179-356c8e0a715f`, `bridgeVersion` là 9.0.0, `protocolVersion` là 1.

## 3. Quá Trình Thực Hiện & Handoff Reference

Quá trình này có thể dùng làm chuẩn cho mọi minigame Wink sau này:
1. **API Registration:** Tương tác với `/admin/games` bằng tài khoản Dev admin để có được một catalog row. Ghi nhận `Game ID` (UUID).
2. **Init Starter Kit:** Chạy script `init-game.mjs` từ Wink Dev Kit, điền `id` và `slug` vừa lấy được. Script này sẽ sinh ra:
   - `public/wink-runtime-config.json`
   - `public/wink-bridge.js`
   - `src/integrations/wink/wink-bridge.ts`
   - `game.config.sh`, `Dockerfile`, `deploy.sh` và các file cấu hình bảo mật.
3. **WinkGameIntegration (client.ts):** Triển khai singleton `winkGame` wrap quanh các API cơ sở của bridge để cung cấp 4 semantics quan trọng: 
   - Không được emit trùng completion (dùng Set lưu `completedRounds`).
   - Tách biệt round start và complete/submit.
   - Quản lý lifecycle.
4. **React Binding (useWinkIntegration.ts):** Viết Hook react để subscribe vào `winkGame.observe`, tự động re-render component khi Wink Bridge có thay đổi state (pause, mute, score).
5. **Typescript & Tests:** Xoá file `types.ts` cũ (từ reference 2048), chỉ sử dụng type sinh tự động từ `wink-bridge.ts`. Các script `npm run typecheck`, `verify:wink-bridge` và `vitest run` phải pass xanh toàn bộ.
6. **Wink Config JSON (`wink-integration.json`):** Trả lời đúng 5 "TODO" liên quan đến semantics cho Wink Admin.
7. **Verify Docker Headers:** Phải run `source game.config.sh && npm run verify:docker-headers` để kiểm chứng Docker serve đúng chuẩn Content-Security-Policy iframe. Kết quả cho BlockBlast: `docker headers verified image=winkgames-block-blast:header-smoke... routes=5 frameAncestors='none'` (Thành công!).

## 4. Trạng Thái Hiện Tại
Dự án 09_blockblast đã đáp ứng ĐẦY ĐỦ tiêu chuẩn Wink Handoff:
- [x] Không còn fallback "2048".
- [x] `verify:wink-bridge` PASS.
- [x] `verify:docker-headers` PASS.
- [x] Typecheck & Unit tests (security-negative) PASS.
- [x] API catalog row tồn tại và khớp cấu hình.
