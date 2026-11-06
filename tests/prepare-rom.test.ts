import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareRom } from "../packages/runtime/src/prepare-rom.ts";
import { digest } from "../packages/storage/src/sram.ts";

const loader = (prepare = async () => {}) => ({
  maxRomBytes: 4,
  validate: (bytes: Uint8Array) => {
    if (bytes[0] !== 1) throw Error("invalid header");
    return { battery: false };
  },
  prepare,
});

test("stored ROM is read and hashed once, then prepared", async () => {
  let reads = 0,
    hashes = 0,
    prepared = false;
  const source = new Blob([new Uint8Array([1, 2])]);
  const read = source.arrayBuffer.bind(source);
  source.arrayBuffer = () => {
    reads++;
    return read();
  };
  const result = await prepareRom(
    loader(async () => {
      prepared = true;
    }),
    source,
    "verified",
    async () => {
      hashes++;
      assert.equal(prepared, false);
      return "verified";
    },
  );
  assert.equal(result.hash, "verified");
  assert.equal(reads, 1);
  assert.equal(hashes, 1);
  assert.equal(prepared, true);
});

test("new ROM hashing and core preparation can overlap", async () => {
  let finish!: (hash: string) => void;
  const identified = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const result = await prepareRom(
    loader(async () => {
      finish("new");
    }),
    new Blob([new Uint8Array([1])]),
    undefined,
    () => identified,
  );
  assert.equal(result.hash, "new");
});

test("invalid, oversized and corrupt ROMs never prepare the core", async () => {
  let prepares = 0;
  const module = loader(async () => {
    prepares++;
  });
  await assert.rejects(
    prepareRom(module, new Blob([new Uint8Array([0])])),
    /invalid header/,
  );
  await assert.rejects(
    prepareRom(module, new Blob([new Uint8Array(5)])),
    /grande/,
  );
  await assert.rejects(
    prepareRom(
      module,
      new Blob([new Uint8Array([1])]),
      "expected",
      async () => "corrupt",
    ),
    /dañada/,
  );
  await assert.rejects(
    prepareRom(
      module,
      new Blob([new Uint8Array([0])]),
      "expected",
      async () => "corrupt",
    ),
    /dañada/,
  );
  await assert.rejects(prepareRom(module), /demo/);
  assert.equal(prepares, 0);
});

test("preparation failures and reading failures propagate; a fresh attempt works", async () => {
  const source = new Blob([new Uint8Array([1])]);
  await assert.rejects(
    prepareRom(
      loader(async () => {
        throw Error("download");
      }),
      source,
    ),
    /download/,
  );
  const broken = new Blob();
  broken.arrayBuffer = async () => {
    throw Error("read failed");
  };
  await assert.rejects(prepareRom(loader(), broken), /read failed/);
  assert.equal(
    (await prepareRom(loader(), source)).hash,
    await digest(new Uint8Array([1])),
  );
});

test("digest respects subviews and snapshots mutable input", async () => {
  const backing = new Uint8Array([9, 1, 2, 9]);
  const expected = await digest(new Uint8Array([1, 2]));
  const pending = digest(backing.subarray(1, 3));
  backing.fill(0);
  assert.equal(await pending, expected);
  const shared = new Uint8Array(new SharedArrayBuffer(2));
  shared.set([1, 2]);
  assert.equal(await digest(shared), expected);
});
