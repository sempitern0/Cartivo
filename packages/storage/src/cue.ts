// Cue sheets (ADR-015): the .cue names the files of a disc, and the player
// opens them together. Shared by the page (to ask for missing tracks before
// starting) and the Worker (to identify the disc and hand the core its files).

/** The files a .cue sheet names, in order (`FILE "name" TYPE` lines). */
export function cueFiles(text: string): string[] {
  return [
    ...text.replace(/^﻿/, "").matchAll(/^\s*FILE\s+(?:"([^"]+)"|(\S+))/gim),
  ].map((m) => m[1] ?? m[2]);
}

/** The last path component, lowercase: how a .cue names its tracks. */
export const trackName = (path: string) =>
  path.replace(/\\/g, "/").split("/").pop()!.toLowerCase();

const TRACK = /\.(bin|img|iso)$/i;

/**
 * Which opened file is each track a cue names, by name in any folder or case.
 * A single track renamed after dumping («Game.bin» for «Game (USA).bin») is
 * still found when it is the only unclaimed track file.
 */
export function matchTracks<F extends { name: string }>(
  names: readonly string[],
  files: readonly F[],
): { tracks: Map<string, F>; missing: string[] } {
  const tracks = new Map<string, F>();
  for (const name of names) {
    const file = files.find((f) => trackName(f.name) === trackName(name));
    if (file) tracks.set(name, file);
  }
  const missing = names.filter((n) => !tracks.has(n));
  const claimed = new Set(tracks.values());
  const spare = files.filter((f) => TRACK.test(f.name) && !claimed.has(f));
  if (missing.length === 1 && spare.length === 1) {
    tracks.set(missing[0], spare[0]);
    missing.pop();
  }
  return { tracks, missing };
}
