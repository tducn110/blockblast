# CORE LOGIC GAME

Tài liệu này giải thích Core Logic của game Block Blast hiện tại, sự cố "khựng" (stutter/lag) khi đặt block, và các biện pháp tối ưu hóa.

## 1. Luồng chạy (Execution Flow) khi đặt khối
Khi người chơi thả tay (pointerup), khối sẽ được kiểm tra:
- Nếu **hợp lệ**, khối chuyển sang trạng thái `snapping` (hút vào ô lưới).
- Trong lúc `snapping`, `app.ticker` sẽ tịnh tiến khối về vị trí ô lưới.
- Khi khoảng cách giữa khối và đích < 1 pixel, nó gọi hàm `onPlacePiece` (của React) và dọn dẹp `dragLayer`.

Hàm `onPlacePiece` sẽ:
1. Tính toán `placePiece` (tạo ra bảng mới với khối được chèn vào).
2. Tính toán `clearLines` (kiểm tra hàng/cột nào ăn điểm, tạo ra bảng mới sau khi xóa).
3. Kiểm tra `isGameOver` (dùng 3 vòng lặp lồng nhau cho mỗi khối còn lại trong khay).
4. Gọi hàng loạt hàm `setState` (setBoard, setScore, setPieces, setClearAnimation).

Sau đó, React sẽ kích hoạt **Re-render**:
1. `PixiBlockBlastCanvas` được render lại.
2. `usePixiBoard` kích hoạt `useEffect`: gọi `blocks.clear()` và tính toán, vẽ lại toàn bộ 64 ô lưới bằng `.roundRect().fill().stroke()`.
3. `usePixiPieces` kích hoạt `useEffect`: tính toán lại vòng lặp `canPlacePiece` để xem có cần làm mờ (gray-out) các khối trong khay không. Sau đó gọi `.clear()` và vẽ lại các khối trong khay.
4. `usePixiAnimations` tạo hàng loạt `Graphics` object mới cho hiệu ứng Flash và hiệu ứng Clear Line (phân tách từng ô, tạo lưới tọa độ, và spawn 150 particles).

## 2. Nguyên nhân gây "khựng" (Stuttering)
Mặc dù các vòng lặp tính toán logic rất nhanh (dưới 1ms), nhưng việc thao tác với PixiJS API lại tốn kém hơn khi diễn ra đồng loạt trong **1 frame duy nhất**:
- **Geometry Generation Spike**: PixiJS phải tạo buffer GPU mới cho hàng chục lệnh `.roundRect()` cùng lúc (bảng mới, khay mới, flash mới).
- **Garbage Collection (GC)**: Việc `destroy()` hoặc `clear()` các đối tượng cũ và tạo các đối tượng `Graphics` mới liên tục khiến trình duyệt phải dọn rác bộ nhớ, gây ra micro-stutter (rớt khung hình).
- **Synchronous Blocking**: Khi React diffing DOM và thực thi tất cả các `useEffect` cùng một lúc, main thread bị block. Nếu tiến trình này mất hơn 16ms (rất dễ xảy ra trên điện thoại), game sẽ bị bỏ qua 1-2 frame hoạt họa (frame drop), khiến người chơi cảm giác bị "khựng" lại ngay khoảnh khắc khối chạm vào bàn cờ.

## 3. Cách khắc phục (Optimizations)
Để game mượt mà 60fps hoàn hảo như Block Blast gốc, cần áp dụng các kỹ thuật sau:
1. **Object Pooling (Tái sử dụng object)**: Thay vì `blocks.clear()` và vẽ lại toàn bộ bàn cờ mỗi khi có thay đổi, ta nên tạo 64 đối tượng `Graphics` (hoặc `Sprite`) tĩnh từ lúc khởi tạo. Khi bảng thay đổi, chỉ cần cập nhật thuộc tính `visible` và `tint`/màu sắc của các object tương ứng.
2. **Tách biệt Animation và React State**: Trì hoãn việc gọi `setState` của React một chút (khoảng vài mili-giây) sau khi trigger hiệu ứng hình ảnh, để trình duyệt có thời gian xử lý frame hiện tại mà không bị chặn bởi React render.
3. **Pre-render Textures**: Thay vì dùng `.roundRect()` và `.stroke()` liên tục, có thể vẽ khối vào một `RenderTexture` một lần duy nhất lúc khởi tạo game, sau đó dùng `Sprite` để hiển thị. GPU xử lý Sprite nhanh hơn gấp hàng trăm lần so với Graphics path.
