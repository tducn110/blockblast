// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import i18n, {
  LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  hasStoredLanguagePreference,
  applyHostLocale,
  formatNumber,
} from "./i18n";

describe("i18n configuration and persistence (05_blockblast)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("has translations for both 'en' and 'vi'", () => {
    expect(i18n.getResourceBundle("en", "translation")).toBeDefined();
    expect(i18n.getResourceBundle("vi", "translation")).toBeDefined();
    expect(i18n.t("BTN_PLAY_AGAIN", { lng: "en" })).toBe("Play Again");
    expect(i18n.t("BTN_PLAY_AGAIN", { lng: "vi" })).toBe("Chơi lại");
  });

  it("translates RANKING_1_10 accurately in Vietnamese", () => {
    expect(i18n.t("RANKING_1_10", { lng: "vi" })).toBe("Xếp hạng 1-10");
    expect(i18n.t("RANKING_1_10", { lng: "en" })).toBe("Ranking 1-10");
  });

  it("persists language change to localStorage when changed", async () => {
    await i18n.changeLanguage("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
    expect(i18n.t("SCORE")).toBe("ĐIỂM");

    await i18n.changeLanguage("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(i18n.t("SCORE")).toBe("SCORE");
  });

  it("defaults to English ('en') on fresh storage (first fallback is English)", () => {
    expect(getInitialLanguage()).toBe("en");
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("falls back to 'en' when storage contains invalid language", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "invalid-locale");
    expect(getInitialLanguage()).toBe("en");
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("hasStoredLanguagePreference returns true only after valid preference is saved", async () => {
    expect(hasStoredLanguagePreference()).toBe(false);
    await i18n.changeLanguage("vi");
    expect(hasStoredLanguagePreference()).toBe(true);
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
  });

  it("applyHostLocale does NOT overwrite localStorage or player preference", async () => {
    // 1. When player already has preference 'en'
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    await i18n.changeLanguage("en");
    expect(hasStoredLanguagePreference()).toBe(true);

    // Host sends 'vi' -> must NOT override user choice
    const result = applyHostLocale("vi");
    expect(result).toBe("en");
    expect(i18n.resolvedLanguage).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");

    // 2. When player has NO preference
    window.localStorage.clear();
    expect(hasStoredLanguagePreference()).toBe(false);

    // Host sends 'vi' -> sets language in memory without polluting localStorage
    const freshResult = applyHostLocale("vi");
    expect(freshResult).toBe("vi");
    expect(i18n.resolvedLanguage).toBe("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("formats numbers based on locale with formatNumber", () => {
    const num = 1234567;
    const formattedVi = formatNumber(num, "vi");
    const formattedEn = formatNumber(num, "en");

    expect(formattedVi).toBe(num.toLocaleString("vi-VN"));
    expect(formattedEn).toBe(num.toLocaleString("en-US"));
  });
});
