// Identity of a CD image (ADR-015): discs reach ~700 MB, so they are never
// read whole. Each file is hashed in fixed blocks with WebCrypto, and the
// identity is the SHA-256 of those block digests (with a version tag, the
// file names and sizes). Fast, streaming and stable for the same files; it
// is not the plain SHA-256 of the image, so it is only compared with itself.
import { digest } from "./sram.ts";

export const DISC_BLOCK_BYTES = 16 * 1024 * 1024;

export type DiscPart = { name: string; blob: Blob };

export async function discIdentity(
  parts: readonly DiscPart[],
  blockBytes = DISC_BLOCK_BYTES,
): Promise<string> {
  const header = new TextEncoder().encode(
    JSON.stringify([
      "cartivo-disc-v1",
      blockBytes,
      parts.map((p) => [p.name.toLowerCase(), p.blob.size]),
    ]),
  );
  const pieces: Uint8Array[] = [header];
  for (const { blob } of parts)
    for (let at = 0; at < blob.size; at += blockBytes) {
      const block = await blob.slice(at, at + blockBytes).arrayBuffer();
      pieces.push(new Uint8Array(await crypto.subtle.digest("SHA-256", block)));
    }
  const all = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    all.set(piece, offset);
    offset += piece.length;
  }
  return digest(all);
}
