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
const SYSTEM_CNF = [
  "BOOT = cdrom:\\PSX.EXE;1",
  "TCB = 4",
  "EVENT = 10",
  "STACK = 801FFFF0",
  "",
].join("\r\n");
const CUE = [
  'FILE "Cartivo Demo (Track 1).bin" BINARY',
  "  TRACK 01 MODE2/2352",
  "    INDEX 01 00:00:00",
  "",
].join("\n");
const RAW = 2352;

const both16 = (view: DataView, at: number, value: number) => {
  view.setUint16(at, value, true);
  view.setUint16(at + 2, value, false);
};
const both32 = (view: DataView, at: number, value: number) => {
  view.setUint32(at, value, true);
  view.setUint32(at + 4, value, false);
};
/** Text padded with spaces to `width`, as ISO 9660 fields are. */
function ascii(out: Uint8Array, at: number, text: string, width = 0) {
  out.set(new TextEncoder().encode(text.padEnd(width, " ")), at);
}

/** An ISO 9660 directory record. */
function record(name: Uint8Array, lba: number, size: number, dir: boolean) {
  let length = 33 + name.length;
  if (length & 1) length++; // records have an even length
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
/** `idle`: the program's colour with no button (ps1ControlDemo). */
export function ps1DiscIso(idle?: number): Uint8Array {
  const exe = ps1ControlDemo(idle);
  const cnf = new TextEncoder().encode(SYSTEM_CNF);
  const ROOT = 20;
  const CNF = 21;
  const EXE = 22;
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
  const pathTable = (at: number, little: boolean) => {
    iso[at] = 1;
    view.setUint32(at + 2, ROOT, little);
    view.setUint16(at + 6, 1, little);
  };
  pathTable(18 * SECTOR, true);
  pathTable(19 * SECTOR, false);
  let at = ROOT * SECTOR;
  const entries = [
    root,
    record(new Uint8Array([1]), ROOT, SECTOR, true),
    record(text.encode("PSX.EXE;1"), EXE, exe.length, false),
    record(text.encode("SYSTEM.CNF;1"), CNF, cnf.length, false),
  ];
  for (const entry of entries) {
    iso.set(entry, at);
    at += entry.length;
  }
  iso.set(cnf, CNF * SECTOR);
  iso.set(exe, EXE * SECTOR);
  return iso;
}

/** 0–99 as binary-coded decimal (12 → 0x12). */
const bcd = (n: number) => parseInt(String(n), 16);

/** The same volume as a raw MODE2/2352 track: sync, header, subheader and
 * user data per sector (EDC/ECC left zero: the core does not check them). */
export function ps1DiscDemo(idle?: number): { cue: string; bin: Uint8Array } {
  const iso = ps1DiscIso(idle);
  const count = iso.length / SECTOR;
  const bin = new Uint8Array(count * RAW);
  for (let lba = 0; lba < count; lba++) {
    const at = lba * RAW;
    bin.fill(0xff, at + 1, at + 11); // sync: 00 FF×10 00
    const msf = lba + 150;
    const minute = bcd(Math.floor(msf / 4500));
    const second = bcd(Math.floor(msf / 75) % 60);
    bin.set([minute, second, bcd(msf % 75), 2], at + 12);
    bin.set([0, 0, 8, 0, 0, 0, 8, 0], at + 16); // form 1, data
    bin.set(iso.subarray(lba * SECTOR, (lba + 1) * SECTOR), at + 24);
  }
  return {
    cue: CUE,
    bin,
  };
}

/** Dark green (BGR): the second disc's colour with no button pressed. */
export const SECOND_DISC_IDLE = 0x206020;

/**
 * A game on two discs, as dumps come: an .m3u naming two .cue sheets, each
 * with its track. Disc 1 is the demo disc (dark blue); disc 2 runs the same
 * program in dark green, so booting it is visible.
 */
export function ps1TwoDiscDemo(): { name: string; bytes: Uint8Array }[] {
  const text = new TextEncoder();
  const files = [
    {
      name: "Cartivo Demo.m3u",
      bytes: text.encode(
        "Cartivo Demo (Disc 1).cue\nCartivo Demo (Disc 2).cue\n",
      ),
    },
  ];
  for (const [n, idle] of [
    [1, undefined],
    [2, SECOND_DISC_IDLE],
  ] as const) {
    const { bin } = ps1DiscDemo(idle);
    const track = `Cartivo Demo (Disc ${n}).bin`;
    files.push(
      {
        name: `Cartivo Demo (Disc ${n}).cue`,
        bytes: text.encode(CUE.replace("Cartivo Demo (Track 1).bin", track)),
      },
      { name: track, bytes: bin },
    );
  }
  return files;
}

const CD_FRAME = 2352 + 96; // a raw sector and its (empty) subchannel
const FRAMES_PER_HUNK = 8;

/**
 * The demo disc as an uncompressed CHD v5 (MAME's format, read by libchdr):
 * header, a map of hunk offsets, one CD track metadata entry (CHT2) and
 * hunks of eight 2448-byte frames. No compression is needed to test the
 * path; real dumps are compressed with the same container.
 */
export function ps1DiscChd(): Uint8Array {
  const { bin } = ps1DiscDemo();
  const frames = bin.length / 2352;
  const hunkBytes = CD_FRAME * FRAMES_PER_HUNK;
  const hunks = Math.ceil(frames / FRAMES_PER_HUNK);
  const meta = new TextEncoder().encode(
    `TRACK:1 TYPE:MODE2_RAW SUBTYPE:NONE FRAMES:${frames} PREGAP:0 PGTYPE:MODE1 PGSUB:RW POSTGAP:0\0`,
  );
  const HEADER = 124;
  const mapOffset = HEADER;
  const metaOffset = mapOffset + hunks * 4;
  // Hunks start on a hunk boundary: the map stores offset / hunk size.
  const firstHunk = Math.ceil((metaOffset + 16 + meta.length) / hunkBytes);
  const out = new Uint8Array((firstHunk + hunks) * hunkBytes);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode("MComprHD"), 0);
  view.setUint32(8, HEADER);
  view.setUint32(12, 5); // version; compressors 16–31 stay 0 (none)
  view.setBigUint64(32, BigInt(hunks * hunkBytes)); // logical bytes
  view.setBigUint64(40, BigInt(mapOffset));
  view.setBigUint64(48, BigInt(metaOffset));
  view.setUint32(56, hunkBytes);
  view.setUint32(60, CD_FRAME); // unit bytes; SHA-1 fields stay 0 (no parent)
  for (let h = 0; h < hunks; h++)
    view.setUint32(mapOffset + h * 4, firstHunk + h);
  out.set(new TextEncoder().encode("CHT2"), metaOffset);
  view.setUint32(metaOffset + 4, meta.length); // flags 0, length; next 0
  out.set(meta, metaOffset + 16);
  for (let f = 0; f < frames; f++)
    out.set(
      bin.subarray(f * 2352, (f + 1) * 2352),
      firstHunk * hunkBytes + f * CD_FRAME,
    );
  return out;
}
