# Bo Lac Block Blast PixiJS

Wink mini-game chạy trong iframe của `https://winkgames.papastudio.net`.
Production game origin là `https://bo-lac-block-blaster.papastudio.net`.

## Local verification

```bash
npm ci
npm run verify:wink-bridge
npm test
npm run typecheck
npm run build
```

Production bắt buộc chạy trong Wink iframe. Mở game trực tiếp ngoài parent
được cho phép sẽ dừng với lỗi `PARENT_REQUIRED`. Runtime config chỉ chứa public
metadata; access token và session authority luôn nằm trong bridge closure.

- Protocol version: `1`
- Bridge version: `9.0.0`
- Allowed parent: `https://winkgames.papastudio.net`
