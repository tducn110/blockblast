# Report 29/06/2026

## Mục tiêu

Giảm lag trong game Block Blast ở các nhịp nặng nhất: lúc thả block, clear line và render feedback.

## Đã làm

1. Cap độ phân giải Pixi ở mức tối đa `2` thay vì dùng thẳng `devicePixelRatio`, để giảm số pixel phải render trên máy mobile.
2. Tắt log PERF mặc định, chỉ bật khi mở game với query `?perf`.
3. Tối ưu drag/preview trong `usePixiPieces`:
   - preview chỉ redraw khi ô mục tiêu thay đổi
   - kéo block bám tay trực tiếp thay vì lerp chậm
   - bỏ double `requestAnimationFrame` ở nhịp commit
   - cache kết quả scan fit của tray theo board + piece
4. Sửa animation particle:
   - scale theo `baseScale` và progress
   - không nhân dồn scale theo từng frame nữa
5. Gom state commit trong `useBlockBlastGame` bằng reducer:
   - placement/update board/pieces/score/feedback đi qua một dispatch chính
   - giảm số lần `setState` dồn vào cùng một frame
6. Thêm `createSmartPieces(board, score)`:
   - sinh bộ piece mới có xét board hiện tại
   - weighted random theo score
   - thử đảm bảo cả 3 piece có thể đặt theo một thứ tự hợp lệ
   - có fallback sang piece dễ hơn khi board quá nghẹt
7. Triệt để xử lý độ khựng (jank) lúc thả block:
   - Dùng `requestAnimationFrame` + `setTimeout(50ms)` để duy trì ghost block đè lên bảng, lùi việc render bảng thật ra phía sau giúp che đi 1-2 frame bị khuyết lúc React commit state.
   - Delay `createSmartPieces` vào một `requestAnimationFrame` tiếp theo khi đặt đủ 3 khối, giúp block placement không bị kẹt bởi quá trình tính toán sinh khối mới.
8. Khắc phục lỗi chớp sáng (flicker) lúc cắm block:
   - Đưa `animationLayer` lên đỉnh layer tree trong `usePixiApp`.
   - Loại bỏ luôn hiệu ứng `placementAnimation` chớp trắng thừa thãi, tận dụng mảnh ghost block tạo độ tiếp đất chân thực mượt mà tuyệt đối.

## File đã sửa

- [src/features/blockblast/render/usePixiApp.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/render/usePixiApp.ts)
- [src/features/blockblast/render/usePixiPieces.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/render/usePixiPieces.ts)
- [src/features/blockblast/render/usePixiBoard.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/render/usePixiBoard.ts)
- [src/features/blockblast/render/usePixiAnimations.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/render/usePixiAnimations.ts)
- [src/features/blockblast/components/PixiBlockBlastCanvas.tsx](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/components/PixiBlockBlastCanvas.tsx)
- [src/features/blockblast/hooks/useBlockBlastGame.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/hooks/useBlockBlastGame.ts)
- [src/features/blockblast/game/blockBlastLogic.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/game/blockBlastLogic.ts)
- [src/features/blockblast/game/debugPerf.ts](/home/pro/Downloads/intern/09_blockblast/src/features/blockblast/game/debugPerf.ts)

## Kiểm tra

- `corepack pnpm build` pass.
- Dev server chạy ổn ở `http://localhost:5173/`.
- `git diff --check` pass.

## Ghi chú

- `repomix-output.xml` đang là file untracked có sẵn trong worktree, mình không đụng tới.
- Browser automation không chạy được vì máy này chưa cài Playwright/Puppeteer.
