// Discs are hashed in blocks; the result must equal WebCrypto's SHA-256 of
// the whole file, so a disc keeps one identity however it is read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { digest } from "../packages/storage/src/sram.ts";
import { digestBlob, Sha256 } from "../packages/storage/src/sha256-stream.ts";

test("known vectors", () => {
  const hex = (text: string) =>
    new Sha256().update(new TextEncoder().encode(text)).hex();
  assert.equal(
    hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(
    hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  );
});

test("any split into chunks gives WebCrypto's digest", async () => {
  const bytes = new Uint8Array(200_003);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + (i >> 7)) & 0xff;
  const expected = await digest(bytes);
  for (const size of [1, 55, 56, 63, 64, 65, 4096, 100_000]) {
    const hash = new Sha256();
    for (let at = 0; at < bytes.length; at += size)
      hash.update(bytes.subarray(at, at + size));
    assert.equal(hash.hex(), expected, `chunks of ${size}`);
  }
  assert.equal(await digestBlob(new Blob([bytes]), 65_536), expected);
  assert.equal(await digestBlob(new Blob([])), await digest(new Uint8Array()));
});
