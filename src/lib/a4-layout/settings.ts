import type { A4LayoutSettings } from "@/lib/a4-layout/types";

/** Figma A4 Bento preset from a4_card_layout_dom_fit_v1_with_AI.html */
export const DEFAULT_A4_SETTINGS: A4LayoutSettings = {
  pageWidthPx: 595,
  pageHeightPx: 842,
  outerMarginPx: 15,
  gapPx: 11,
  paddingXPx: 20,
  paddingYPx: 11,
  bodyPx: 10,
  bodyLinePx: 12,
  titlePillPx: 28,
  insetPaddingYPx: 10,
  avgCharEm: 0.49,
  safety: 1.08,
  optimizerMode: "balanced",
};
