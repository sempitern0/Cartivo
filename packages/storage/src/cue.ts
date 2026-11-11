// Cue sheets and .m3u playlists (ADR-015): a .cue names the files of a disc,
// an .m3u the discs of a game, and the player opens them together. Shared by
// the page (to ask for missing files before starting) and the Worker (to
// identify the game and hand the core its files).

/** A .cue or .m3u is a few lines of text: anything larger is not one. */
export const MAX_SHEET_BYTES = 1024 * 1024;

/**
 * The text of a .cue or .m3u. Refuses a file too large to be one (a disc
 * image with the wrong extension) instead of reading it whole into memory.
 */
export async function sheetText(name: string, blob: Blob): Promise<string> {
  if (blob.size > MAX_SHEET_BYTES)
    throw Error(
      `«${name}» es demasiado grande para ser una lista de archivos (.cue o .m3u). Comprueba que no sea la imagen del disco con otra extensión.`,
    );
  return blob.text();
}

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

/** The discs an .m3u lists, in order: one file per line, # starts a comment. */
export function m3uFiles(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

const isCue = (name: string) => name.toLowerCase().endsWith(".cue");
const isM3u = (name: string) => name.toLowerCase().endsWith(".m3u");

/** A file of the game, under the name the core asks for. */
export type LayoutPart<F> = { name: string; file: F };

/**
 * The files a game needs, from its first file: an .m3u lists discs (each a
 * .cue with its tracks, a .chd, an .iso…), a .cue lists tracks, anything else
 * is a disc by itself. `boots` is the file the core opens for each disc, in
 * order; `missing`, the names listed but not opened.
 */
export async function resolveDisc<F extends { name: string }>(
  first: F,
  others: readonly F[],
  text: (file: F) => Promise<string>,
): Promise<{ parts: LayoutPart<F>[]; boots: string[]; missing: string[] }> {
  const parts: LayoutPart<F>[] = [];
  const boots: string[] = [];
  const missing: string[] = [];
  const unclaimed = () =>
    others.filter((f) => !parts.some((part) => part.file === f));
  const cue = async (sheet: F, name: string) => {
    parts.push({ name, file: sheet });
    const named = matchTracks(cueFiles(await text(sheet)), unclaimed());
    // A renamed track is offered to the core under the name the cue uses;
    // the others keep their own (the game's identity uses these names).
    for (const [track, file] of named.tracks)
      parts.push({
        name: trackName(file.name) === trackName(track) ? file.name : track,
        file,
      });
    missing.push(...named.missing);
  };
  if (isM3u(first.name)) {
    parts.push({ name: first.name, file: first });
    for (const entry of m3uFiles(await text(first))) {
      const file = unclaimed().find(
        (f) => trackName(f.name) === trackName(entry),
      );
      if (!file) {
        missing.push(entry);
        continue;
      }
      boots.push(file.name);
      if (isCue(file.name)) await cue(file, file.name);
      else parts.push({ name: file.name, file });
    }
  } else if (isCue(first.name)) {
    boots.push(first.name);
    await cue(first, first.name);
  } else {
    boots.push(first.name);
    parts.push({ name: first.name, file: first });
  }
  return { parts, boots, missing };
}
