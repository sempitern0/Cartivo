// Core identifiers only, safe to import from the UI thread (no core code).
export const nesCores = ["tetanes", "jsnes"] as const;
export type NesCoreId = (typeof nesCores)[number];
