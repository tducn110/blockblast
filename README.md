# Xếp Khối Bộ Lạc

React/Vite version of the Block Blast-style mini game exported from Figma Make.

## Running the code

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

## Wink Integration

This game is integrated with the Wink platform and operates exclusively inside a Wink `iframe`.
Any direct standalone load will fail with a `PARENT_REQUIRED` error.
To test the bridge, run: `npm run verify:wink-bridge`

