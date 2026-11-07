/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * A PlayStation CD image built from scratch: a minimal ISO 9660 volume with
 * SYSTEM.CNF and PSX.EXE (the ps1-control-demo program), written as raw
 * MODE2/2352 sectors in a .bin with its .cue, the way discs are dumped.
 * It tests the disc path (cue sheet, tracks opened by name through the VFS,
 * the core reading SYSTEM.CNF) without a commercial disc. No Sony licence
 * text, logo or code is included. Same oracle as ps1-control-demo.
 */
import { ps1ControlDemo } from "./ps1-control-demo.ts";

const SECTOR = 2048;
const RAW = 2352;

const both16 = (view: DataView, at: number, value: number) => {
  view.setUint16(at, value, true);
  view.setUint16(at + 2, value, false);
};
const both32 = (view: DataView, at: number, value: number) => {
  view.setUint32(at, value, true);
  view.setUint32(at + 4, value, false);
};
const ascii = (
  out: Uint8Array,
  at: number,
  text: string,
  width = text.length,
) => out.set(new TextEncoder().encode(text.padEnd(width, " ")), at);

/** An ISO 9660 directory record. */
function record(name: Uint8Array, lba: number, size: number, dir: boolean) {
  const length = 33 + name.length + ((33 + name.length) % 2);
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  out[0] = length;
  both32(view, 2, lba);
  both32(view, 10, size);
  out.set([126, 1, 1, 0, 0, 0, 0], 18); // 2026-01-01 00:00:00 UTC
  out[25] = dir ? 2 : 0;
  both16(view, 28, 1);
  out[32] = name.length;
  out.set(name, 33);
  return out;
}

/** The volume as 2048-byte sectors (logical image, like an .iso). */
export function ps1DiscIso(): Uint8Array {
  const exe = ps1ControlDemo();
  const cnf = new TextEncoder().encode(
    "BOOT = cdrom:\\PSX.EXE;1\r\nTCB = 4\r\nEVENT = 10\r\nSTACK = 801FFFF0\r\n",
  );
  const ROOT = 20,
    CNF = 21,
    EXE = 22;
  const sectors = EXE + Math.ceil(exe.length / SECTOR);
  const iso = new Uint8Array(sectors * SECTOR);
  const view = new DataView(iso.buffer);
  const text = new TextEncoder();
  const root = record(new Uint8Array([0]), ROOT, SECTOR, true);

  // Primary volume descriptor (sector 16) and terminator (17).
  const pvd = 16 * SECTOR;
  iso[pvd] = 1;
  ascii(iso, pvd + 1, "CD001");
  iso[pvd + 6] = 1;
  ascii(iso, pvd + 8, "PLAYSTATION", 32);
  ascii(iso, pvd + 40, "CARTIVO_DEMO", 32);
  both32(view, pvd + 80, sectors);
  both16(view, pvd + 120, 1);
  both16(view, pvd + 124, 1);
  both16(view, pvd + 128, SECTOR);
  both32(view, pvd + 132, 10); // path table: the root only
  view.setUint32(pvd + 140, 18, true);
  view.setUint32(pvd + 148, 19, false);
  iso.set(root, pvd + 156);
  iso[pvd + 881] = 1;
  iso[17 * SECTOR] = 255;
  ascii(iso, 17 * SECTOR + 1, "CD001");
  iso[17 * SECTOR + 6] = 1;

  // Path tables (little- and big-endian), root directory, then the files.
  for (const [at, little] of [
    [18 * SECTOR, true],
    [19 * SECTOR, false],
  ] as const) {
    iso[at] = 1;
    view.setUint32(at + 2, ROOT, little);
    view.setUint16(at + 6, 1, little);
  }
  let at = ROOT * SECTOR;
  for (const entry of [
    root,
    record(new Uint8Array([1]), ROOT, SECTOR, true),
    record(text.encode("PSX.EXE;1"), EXE, exe.length, false),
    record(text.encode("SYSTEM.CNF;1"), CNF, cnf.length, false),
  ]) {
    iso.set(entry, at);
    at += entry.length;
  }
  iso.set(cnf, CNF * SECTOR);
  iso.set(exe, EXE * SECTOR);
  return iso;
}

const bcd = (n: number) => ((n / 10) << 4) | (n % 10);

/** The same volume as a raw MODE2/2352 track: sync, header, subheader and
 * user data per sector (EDC/ECC left zero: the core does not check them). */
export function ps1DiscDemo(): { cue: string; bin: Uint8Array } {
  const iso = ps1DiscIso();
  const count = iso.length / SECTOR;
  const bin = new Uint8Array(count * RAW);
  for (let lba = 0; lba < count; lba++) {
    const at = lba * RAW;
    bin.fill(0xff, at + 1, at + 11); // sync: 00 FF×10 00
    const msf = lba + 150;
    bin.set(
      [
        bcd(Math.floor(msf / 4500)),
        bcd(Math.floor(msf / 75) % 60),
        bcd(msf % 75),
        2,
      ],
      at + 12,
    );
    bin.set([0, 0, 8, 0, 0, 0, 8, 0], at + 16); // form 1, data
    bin.set(iso.subarray(lba * SECTOR, (lba + 1) * SECTOR), at + 24);
  }
  return {
    cue: 'FILE "Cartivo Demo (Track 1).bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n',
    bin,
  };
}
