// Player profiles (ADR-016): validation, the first profile owning the
// original store names, new ids and colours, and deleting a profile's data.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteProfileData,
  MAX_PROFILES,
  newProfile,
  PRINCIPAL,
  PROFILES_KEY,
  profileName,
  readProfiles,
  scoped,
  writeProfiles,
  type Profile,
} from "../packages/storage/src/profiles.ts";
import { parseRequest } from "../packages/runtime/src/protocol.ts";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

test("the first profile keeps the original store names", () => {
  assert.equal(scoped("cartivo-saves", PRINCIPAL), "cartivo-saves");
  assert.equal(scoped("cartivo-saves", "ab12cd34"), "cartivo-saves@ab12cd34");
  assert.equal(scoped("cartivo:keyboard:v1", "x1"), "cartivo:keyboard:v1@x1");
});

test("there is always a first profile, and stored lists are validated", () => {
  assert.deepEqual(readProfiles(memory()), [
    { id: PRINCIPAL, name: "Jugador 1", color: 0 },
  ]);
  const store = memory({
    [PROFILES_KEY]: JSON.stringify([
      { id: "ana1", name: "  Ana  ", color: 2 },
      { id: "Bad!", name: "x", color: 0 },
      { id: "ana1", name: "Duplicada", color: 1 },
      { id: PRINCIPAL, name: "Casa", color: 3 },
      { id: "luis", name: "", color: 1 },
      { id: "eva", name: "Eva", color: 9 },
    ]),
  });
  assert.deepEqual(readProfiles(store), [
    { id: PRINCIPAL, name: "Casa", color: 3 },
    { id: "ana1", name: "Ana", color: 2 },
  ]);
  assert.deepEqual(
    readProfiles(memory({ [PROFILES_KEY]: "{not json" })).map((p) => p.id),
    [PRINCIPAL],
  );
});

test("new profiles get a unique id, a free colour and a valid name", () => {
  const first = readProfiles(memory());
  const ana = newProfile(" Ana ", first, () => 0.5);
  assert.match(ana.id, /^[a-z0-9]{8}$/);
  assert.equal(ana.name, "Ana");
  assert.equal(ana.color, 1);
  // A colliding id is drawn again.
  const draws = [0.5, 0.25];
  const luis = newProfile("Luis", [...first, ana], () => draws.shift()!);
  assert.notEqual(luis.id, ana.id);
  assert.throws(() => newProfile("   ", first), /nombre/);
  assert.throws(() => newProfile("x".repeat(25), first), /nombre/);
  const full: Profile[] = Array.from({ length: MAX_PROFILES }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    color: 0,
  }));
  assert.throws(() => newProfile("Otro", full), /perfiles/);
  assert.equal(profileName("  Dos   espacios "), "Dos espacios");
  const store = memory();
  writeProfiles([...first, ana], store);
  assert.deepEqual(readProfiles(store), [...first, ana]);
});

test("deleting a profile removes its databases and preferences only", async () => {
  const deleted: string[] = [];
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    deleteDatabase(name: string) {
      deleted.push(name);
      const req: { onsuccess?: () => void } = {};
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  };
  const store = memory({
    "cartivo:keyboard:v1": "{}",
    "cartivo:keyboard:v1@ana1": "{}",
    "cartivo:input:v1:Pad:17:4@ana1": "{}",
    "cartivo:input:v1:Pad:17:4@ana12": "{}",
  });
  await deleteProfileData("ana1", store);
  assert.deepEqual(deleted.sort(), [
    "cartivo-library@ana1",
    "cartivo-saves@ana1",
    "cartivo-states@ana1",
  ]);
  assert.deepEqual(
    [...store.data.keys()],
    ["cartivo:keyboard:v1", "cartivo:input:v1:Pad:17:4@ana12"],
  );
  await assert.rejects(deleteProfileData(PRINCIPAL, store), /no se puede/);
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
});

test("load names a valid profile or none", () => {
  const base = { v: 1, session: "s", id: 1, command: "load", demo: true };
  assert.equal(parseRequest({ ...base, profile: "ana1" }).profile, "ana1");
  assert.equal(parseRequest(base).profile, undefined);
  assert.throws(() => parseRequest({ ...base, profile: "../x" }), /Perfil/);
});
