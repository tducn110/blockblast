import { blockBlastAudio } from "@/features/blockblast/audio/blockBlastAudio";

// Preload strictly CRITICAL resources required for the initial game view.
// ponytail: standard font and essential asset barrier without bloated queues

let criticalPreloadPromise: Promise<void> | null = null;

async function preloadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load('400 16px "Be Vietnam Pro"'),
      document.fonts.load('700 16px "Be Vietnam Pro"'),
      document.fonts.load('800 16px "Be Vietnam Pro"'),
      document.fonts.load('500 16px "Plus Jakarta Sans"'),
      document.fonts.load('600 16px "Plus Jakarta Sans"'),
      document.fonts.load('700 16px "Plus Jakarta Sans"'),
      document.fonts.load('800 16px "Plus Jakarta Sans"'),
      document.fonts.load('500 16px "Space Grotesk"'),
      document.fonts.load('700 16px "Space Grotesk"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Non-fatal font load fallback
  }
}

async function preloadImage(src: string): Promise<void> {
  if (typeof window === 'undefined') return;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function preloadCriticalResources(onProgress?: (pct: number) => void): Promise<void> {
  if (criticalPreloadPromise) return criticalPreloadPromise;

  criticalPreloadPromise = (async () => {
    onProgress?.(15);

    // Phase 1: Fonts & Critical Visual Assets (Mascot & Brand)
    await Promise.allSettled([
      preloadFonts(),
      preloadImage("/assets/optimized/peanut_static-180.webp"),
      preloadImage("/assets/brand/PapaStudio_Logo_Full_Black.png"),
      preloadImage("/assets/brand/PapaStudio_Logo_Symbol_Black.png"),
    ]);
    onProgress?.(55);

    // Phase 2: Core audio buffers & audio elements
    await Promise.allSettled([
      blockBlastAudio.preload(),
    ]);
    onProgress?.(95);
  })()
    .then(() => undefined)
    .catch((error) => {
      criticalPreloadPromise = null;
      throw error;
    });

  return criticalPreloadPromise;
}

export function preloadNonCriticalResources(): void {
  // Deferred non-critical tasks: pre-warm music network buffer
  if (typeof window !== "undefined" && typeof fetch !== "undefined") {
    fetch("/assets/audio/music.mp3").catch(() => {});
  }
}
