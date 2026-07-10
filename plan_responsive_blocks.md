# Kế Hoạch Sửa Responsive, Kéo Thả Và Hồi Sinh

## Mục tiêu

- Ghost block luôn có cùng kích thước logic với cell trên board ở mọi viewport.
- Kéo block bám theo ngón tay, hút vào cell hợp lệ như Block Blast, không lệch khi resize hoặc stage đang rung.
- Thả hụt có chuyển động trả block về khay; huỷ pointer không để ghost hoặc trạng thái kéo bị kẹt.
- Revive chỉ dùng một lần: giữ nguyên board và điểm hiện tại, bỏ toàn bộ tray/reserve cũ, sinh đúng 3 rescue block có thể tiếp tục đặt.
- Nếu người chơi đã revive, game-over tiếp theo mở thẳng màn kết quả có nút x2 hiện tại.

## Thay đổi

1. Đồng bộ kích thước
   - Bỏ `ghostContainer.scale.set(1.15)`; ghost dùng scale `1` trong lúc kéo và snap.
   - Dùng `dragLayer.toLocal(event.global)` để Pixi tự xử lý world scale, offset và stage shake.
   - Offset tránh ngón tay tính theo CSS pixel rồi đổi về world unit.

2. Kéo và snapping
   - Ghi nhận `pointerId`, lọc pointer khác và xử lý `pointercancel`/blur.
   - Tính lại snap candidate ngay lúc `pointerup`, không dùng candidate của frame cũ.
   - Tìm cell hợp lệ gần nhất trong bán kính hút giới hạn và giữ candidate ổn định ở ranh giới cell.
   - Thả hụt chạy animation trả về tâm slot rồi mới hiện lại preview.

3. Revive
   - Thêm `reviveUsed` vào game state.
   - Lần kẹt đầu mở `reviveOffer`; chấp nhận bằng một action nguyên tử, giữ board/score, xoá tray và reserve cũ, sinh 3 block rescue.
   - Rescue ưu tiên block nhỏ và placement có khả năng clear row/column; fallback là 3 block đơn có thể đặt tuần tự.
   - Lần kẹt sau `reviveUsed` đi thẳng `gameOver`; không hiện prompt lần hai.
   - Bỏ cơ chế cũ xoá trắng board rồi tạo ván mới.

## Tiêu chí bàn giao

- Cell của ghost và board trùng nhau, không còn co từ `1.15` về `1` khi thả.
- Kéo ra ngoài canvas, đổi pointer, huỷ touch hoặc resize không để lại ghost.
- Revive không đổi pattern board, thay tray đúng 3 block và không thể gọi lần hai.
- Lần thua sau revive hiện trực tiếp màn x2.
- Không chạy test/build tự động trong lượt này; phần kiểm tra cảm giác kéo-thả do người dùng tự thực hiện.
