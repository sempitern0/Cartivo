import type { Plugin } from "vite";
export const SW_FILE: string;
export const CACHE_PREFIX: string;
export function shouldPrecache(path: string): boolean;
export function precacheVersion(entries: { path: string; hash: string }[]): string;
export function buildServiceWorker(entries: { path: string; hash: string }[]): string;
export function cartivoPwa(): Plugin;
