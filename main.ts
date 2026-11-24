// The World in One Day — Monday 23 November 2026
// make.fun bounty news-image-20261123: "Sum up 23 November's world news
// in one image". This program draws a one-page newspaper of the day's
// verified news and writes it to /output/entry.png.
//
// Everything is drawn from scratch in this file: a hand-defined 5x7
// bitmap font (my own glyph table), a small raster canvas, and a
// hand-written PNG encoder on top of Node's zlib. Node 22 standard
// library only. No network, no clock, no randomness — two runs write
// byte-identical output.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- font --
// My own 5x7 bitmap glyphs. Each glyph is 7 rows; each row is a 5-bit
// number, bit 4 = leftmost column. Only capitals, digits and punctuation
// are defined: all text is uppercased before drawing.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "%": [25, 25, 2, 4, 8, 19, 19],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  $: [4, 15, 20, 14, 5, 30, 4],
  "#": [10, 10, 31, 10, 31, 10, 10],
  "@": [14, 17, 23, 21, 22, 16, 14],
  "*": [0, 4, 21, 14, 21, 4, 0],
  "\u2022": [0, 0, 14, 14, 14, 0, 0],
  "\u2192": [0, 4, 2, 31, 2, 4, 0],
  "\u00d7": [0, 17, 10, 4, 10, 17, 0],
  "\u00b0": [14, 17, 17, 14, 0, 0, 0],
  "<": [2, 4, 8, 16, 8, 4, 2],
  ">": [8, 4, 2, 1, 2, 4, 8],
  "[": [14, 8, 8, 8, 8, 8, 14],
  "]": [14, 2, 2, 2, 2, 2, 14],
  _: [0, 0, 0, 0, 0, 0, 31],
  "~": [0, 0, 10, 21, 0, 0, 0],
};

// Normalise text to the glyph set above, then uppercase it.
function normalise(s: string): string {
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00b7/g, "-")
    .toUpperCase();
}

// Width in pixels of `s` at the given scale and inter-glyph tracking.
function textWidth(s: string, scale: number, track: number): number {
  const t = normalise(s);
  if (t.length === 0) return 0;
  return t.length * (5 * scale + track) - track;
}

// Greedy word wrap. Returns at most maxLines lines that fit maxW.
function wrap(
  s: string,
  maxW: number,
  scale: number,
  track: number,
  maxLines: number,
): string[] {
  const words = normalise(s).split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale, track) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur !== "" && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

// Truncate `s` with an ellipsis so it fits maxW.
function truncate(s: string, maxW: number, scale: number, track: number): string {
  const t = normalise(s);
  if (textWidth(t, scale, track) <= maxW) return t;
  const ell = "...";
  let out = "";
  for (const ch of t) {
    if (textWidth(out + ch + ell, scale, track) > maxW) break;
    out += ch;
  }
  return out.replace(/\s+$/, "") + ell;
}

// ------------------------------------------------------------- palette --
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 232];
const INK: RGB = [22, 22, 22];
const RED: RGB = [176, 30, 30];
const BLUE: RGB = [30, 78, 140];
const SEA: RGB = [198, 224, 236];
const SEA_DARK: RGB = [120, 170, 205];
const LAND: RGB = [216, 206, 170];
const LAND_DARK: RGB = [178, 164, 120];
const GREY: RGB = [112, 110, 102];
const CREAM: RGB = [238, 232, 214];
const WHITE: RGB = [255, 255, 255];
const GREEN: RGB = [34, 120, 60];

// ------------------------------------------------------------- canvas --
class Canvas {
  buf = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(PAPER);
  }
  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        this.set(xx, yy, c);
      }
    }
  }
  hline(x: number, y: number, w: number, c: RGB, thick = 1): void {
    this.rect(x, y, w, thick, c);
  }
  vline(x: number, y: number, h: number, c: RGB, thick = 1): void {
    this.rect(x, y, thick, h, c);
  }
  // 1px outline box.
  box(x: number, y: number, w: number, h: number, c: RGB): void {
    this.hline(x, y, w, c);
    this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c);
    this.vline(x + w - 1, y, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  dashedLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: RGB,
    dash = 5,
    gap = 4,
  ): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    let on = true;
    let run = 0;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      if (on) this.set(x, y, c);
      run++;
      if (run >= (on ? dash : gap)) {
        on = !on;
        run = 0;
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (filled ? d <= r : Math.abs(d - r) < 0.9) this.set(cx + x, cy + y, c);
      }
    }
  }
  // Even-odd scanline fill of a polygon given as [x, y] pairs.
  poly(points: Array<[number, number]>, c: RGB): void {
    let minY = H;
    let maxY = 0;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
          this.set(x, y, c);
        }
      }
    }
  }
  // Draw one glyph cell; `track` is the gap between glyphs.
  drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (16 >> col)) {
          this.rect(x + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
  text(
    x: number,
    y: number,
    s: string,
    scale: number,
    c: RGB,
    track?: number,
  ): number {
    const t = normalise(s);
    const tr = track === undefined ? scale : track;
    let cx = x;
    for (const ch of t) {
      this.drawChar(cx, y, ch, scale, c);
      cx += 5 * scale + tr;
    }
    return cx - tr - x; // width actually drawn
  }
  // Centred text; returns the x where drawing started.
  textCentred(
    cx: number,
    y: number,
    s: string,
    scale: number,
    c: RGB,
    track?: number,
  ): number {
    const tr = track === undefined ? scale : track;
    const w = textWidth(s, scale, tr);
    const x = Math.round(cx - w / 2);
    this.text(x, y, s, scale, c, tr);
    return x;
  }
}

// ------------------------------------------------------- PNG encoding --
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(c: Canvas): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(c.buf.buffer, y * W * 3, W * 3).copy(
      raw,
      y * (1 + W * 3) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ the news --
// All facts below come from the verified 23 November 2026 news dossier.
// Stories that happened on Sunday 22 Nov carry an honest date label
// (SUNDAY / SUNDAY NIGHT / REPORTED MONDAY) — never presented as if
// they happened on Monday.

interface Lead {
  kicker: string;
  headline: string;
  body: string;
  badge: string; // OFFICIAL / CONFIRMED / REPORTED
  sources: string;
  art: "sea" | "chart" | "globe";
}

const LEADS: Lead[] = [
  {
    kicker: "BLACK SEA WAR \u2022 LIBYA",
    headline: "UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA",
    body: "Zelenskyy confirmed on Monday that Ukrainian sea drones sank the Russian corvette Merkury in Benghazi port. A Ka-27 helicopter was destroyed with her.",
    badge: "CONFIRMED",
    sources: "AP, BBC, REUTERS",
    art: "sea",
  },
  {
    kicker: "TECH \u2022 MARKETS",
    headline: "HUANG BACK AT NVIDIA; SHARES SOAR 33%",
    body: "Nvidia's board restored Jensen Huang as CEO on Monday, 11 days after he quit amid a scandal. Shares closed up 31-33%; the S&P 500 rose 4.82%.",
    badge: "OFFICIAL",
    sources: "NVIDIA, AP, REUTERS",
    art: "chart",
  },
  {
    kicker: "CLIMATE \u2022 TURKEY",
    headline: "COP31 ENDS WITH NO DEAL",
    body: "The UN climate summit in Antalya ended SUNDAY without a main deal, the first failure since 2009. On Monday, island states and the EU condemned it.",
    badge: "CONFIRMED",
    sources: "UN NEWS, BBC, AFP",
    art: "globe",
  },
];

interface Middle {
  headline: string;
  body: string;
  badge: string;
  sources: string;
}

const MIDDLE: Middle[] = [
  {
    headline: "RUSSIAN STRIKE ON DYMER KILLS 11",
    body: "DRONE WRECKED A FIVE-STOREY BLOCK; 11 DEAD.",
    badge: "CONFIRMED",
    sources: "AP",
  },
  {
    headline: "NATO EMERGENCY SESSION OVER POLAND MISSILES",
    body: "POLAND: OBJECTS WERE RUSSIAN KH-101 MISSILES.",
    badge: "CONFIRMED",
    sources: "REUTERS, AP",
  },
  {
    headline: "EU PROPOSES 22ND SANCTIONS PACKAGE ON RUSSIA",
    body: "60 BANKS OFF SWIFT; 70+ SHIPS BLACKLISTED.",
    badge: "OFFICIAL",
    sources: "EUROPEAN COMMISSION",
  },
  {
    headline: "HORMUZ: THREE MORE TANKERS HIT",
    body: "THREE TANKERS HIT; IRAN CLAIMS US DRONE DOWN.",
    badge: "REPORTED",
    sources: "REUTERS, UKMTO",
  },
  {
    headline: "INDONESIA FACTORY FIRE: 24 DEAD, 30 MISSING",
    body: "FIRE TOLL CONFIRMED: 24 DEAD, 30 MISSING.",
    badge: "CONFIRMED",
    sources: "AP, REUTERS",
  },
  {
    headline: "DEMOCRATS LOCK IN 258 HOUSE SEATS",
    body: "BIGGEST DEMOCRATIC MAJORITY SINCE 1992.",
    badge: "CONFIRMED",
    sources: "AP, CBS",
  },
  {
    headline: "INDIA GIVES NEPAL $1.62BN FLOOD PACKAGE",
    body: "$377M GRANTS + $1.24BN CREDIT FOR NEPAL.",
    badge: "OFFICIAL",
    sources: "REUTERS, AP",
  },
  {
    headline: "OXFAM: GAZA NOW A 'TOXIC WASTELAND'",
    body: "CONTAMINATION INDICATORS COVER OVER 99% OF GAZA.",
    badge: "OFFICIAL",
    sources: "OXFAM",
  },
  {
    headline: "BELGIUM HALTS AS STRIKE CANCELS 429 FLIGHTS",
    body: "429 FLIGHTS AXED AT BRUSSELS; 59,000 HIT.",
    badge: "CONFIRMED",
    sources: "BBC",
  },
  {
    headline: "FIFA NAMES 2031 + 2035 WOMEN'S CUP HOSTS",
    body: "2031: US, MEXICO, COSTA RICA, JAMAICA.",
    badge: "OFFICIAL",
    sources: "FIFA",
  },
];

// Short one-liners. Items marked (SUN) happened Sunday 22 Nov; the
// label is part of the line so the date stays honest.
const ALSO: string[] = [
  "SUDAN: DRONES HIT HOMES, UN SITE",
  "WEST BANK: SETTLER ARSON CONDEMNED",
  "BANGLADESH: HASINA TO BE HELD IF SHE RETURNS",
  "UK SANCTIONS MYANMAR GENERALS",
  "KENYA, DR CONGO RESTORE FULL TIES",
  "NIGERIA BOAT TRAGEDY: 24 DEAD",
  "TAIWAN COUNTS 24 CHINESE JETS, 11 SHIPS",
  "INFLATION: IRAN 76.8%, ARGENTINA 2.2%",
  "ALCARAZ WINS FIRST ATP FINALS (SUN)",
  "MANCHESTER: 12,000 EVACUATED (SUN NIGHT)",
  "MILEY CYRUS MARRIES MAXX MORANDO",
  "MOLLY MELDRUM DIES AT 83",
  "PAOLO BULGARI DIES AT 89",
  "FBI PROBES HACK OF CRIME DATABASE",
  "REP. GOMEZ TO RESIGN AFTER ETHICS FINDING",
  "BEPICOLOMBO: MERCURY ORBIT UPDATE DUE",
  "DELTA OUTAGE DELAYS 600+ FLIGHTS (SUN)",
  "SPARTA II TOWED OUT OF FINNISH WATERS",
  "GREECE RENEWS PARTHENON MARBLES DEMAND",
];

const TIMELINE: Array<[string, string]> = [
  ["02:00", "CONCERT EVACUATED"],
  ["06:30", "KOSPI -3.3%"],
  ["07:38", "BRENT $92.10"],
  ["09:12", "MERKURY SUNK"],
  ["11:59", "TANKERS HIT"],
  ["13:30", "HUANG RETURNS"],
  ["19:30", "IRAN: DRONE DOWN"],
  ["21:48", "TANKERS ABLAZE"],
];

const BIG_NUMBERS: Array<[string, string]> = [
  ["258", "HOUSE SEATS"],
  ["+33%", "NVIDIA SHARES"],
  ["-3.3%", "KOSPI CLOSE"],
  ["24", "CIKANDE DEAD"],
  ["$1.62BN", "AID TO NEPAL"],
  ["429", "FLIGHTS AXED"],
];

// World-map dots, in map-box coordinates (map box x 20..1004, y 716..796).
// Numbers match the legend line under the map.
const MAP_DOTS: Array<{ x: number; y: number; n: number }> = [
  { x: 470, y: 726, n: 1 }, // Manchester
  { x: 492, y: 736, n: 2 }, // Brussels
  { x: 522, y: 734, n: 3 }, // Kyiv / Dymer
  { x: 545, y: 742, n: 4 }, // Antalya
  { x: 501, y: 754, n: 5 }, // Benghazi
  { x: 612, y: 748, n: 6 }, // Strait of Hormuz
  { x: 660, y: 744, n: 7 }, // New Delhi
  { x: 772, y: 768, n: 8 }, // Cikande, Banten
];

const MAP_LEGEND =
  "1 MANCHESTER  2 BRUSSELS  3 KYIV  4 ANTALYA  5 BENGHAZI  6 HORMUZ  7 NEW DELHI  8 CIKANDE";

const FOOTER_1 =
  "DATE CHECK: MERKURY CONFIRMED MONDAY; HUANG RESTORED MONDAY; FIFA NAMED 2031 + 2035 HOSTS MONDAY.";
const FOOTER_2 =
  "COP31 ENDED SUNDAY - MONDAY BROUGHT REACTION ONLY. SOURCES: AP, REUTERS, BBC, AFP, AL JAZEERA.";

// ------------------------------------------------------------ layout ---
const MX = 16; // left margin
const CW = 992; // content width

function drawBadge(
  c: Canvas,
  x: number,
  y: number,
  badge: string,
  sources: string,
): void {
  const bw = textWidth(badge, 2, 0) + 12;
  c.rect(x, y, bw, 18, RED);
  c.text(x + 6, y + 2, badge, 2, WHITE, 0);
  c.text(x + bw + 8, y + 2, sources, 2, INK, 0);
}

// --- lead illustrations, drawn with code primitives --------------------
function artSea(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, SEA);
  // waves
  for (let i = 0; i < 3; i++) {
    const wy = y + h - 14 - i * 10;
    for (let wx = x + 6; wx < x + w - 6; wx += 18) {
      c.line(wx, wy, wx + 8, wy - 3, SEA_DARK);
      c.line(wx + 8, wy - 3, wx + 16, wy, SEA_DARK);
    }
  }
  // corvette silhouette
  const sx = x + 90;
  const sy = y + h - 20;
  c.poly(
    [
      [sx, sy],
      [sx + 130, sy],
      [sx + 118, sy + 12],
      [sx + 12, sy + 12],
    ],
    INK,
  );
  c.rect(sx + 55, sy - 16, 6, 16, INK);
  c.rect(sx + 80, sy - 10, 20, 10, INK);
  c.rect(sx + 61, sy - 22, 14, 6, RED); // flag
  // explosion star above the ship
  const ex = sx + 95;
  const ey = sy - 16;
  for (const [dx, dy] of [
    [0, -8],
    [0, 8],
    [-8, 0],
    [8, 0],
    [-6, -6],
    [6, -6],
    [-6, 6],
    [6, 6],
  ] as Array<[number, number]>) {
    c.line(ex, ey, ex + dx, ey + dy, RED);
  }
  // three sea drones approaching, dashed tracks
  for (let i = 0; i < 3; i++) {
    const dx = x + w - 30 - i * 26;
    const dy = y + 8 + i * 10;
    c.dashedLine(dx, dy, ex + 20 - i * 10, ey + 6, INK, 4, 3);
    c.rect(dx - 4, dy - 3, 8, 6, INK);
  }
  c.text(x + 8, y + 6, "7 SEA DRONES", 2, BLUE, 0);
}

function artChart(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, CREAM);
  const ox = x + 14;
  const oy = y + h - 14;
  c.line(ox, y + 8, ox, oy, GREY);
  c.line(ox, oy, x + w - 10, oy, GREY);
  // grid lines
  for (let i = 1; i <= 3; i++) {
    const gy = oy - (i * (h - 30)) / 4;
    c.dashedLine(ox, gy, x + w - 10, gy, GREY, 3, 4);
  }
  // share price line, rising steeply (fractions of the chart height)
  const ch = h - 22;
  const pts: Array<[number, number]> = [
    [ox + 6, oy - Math.round(0.08 * ch)],
    [ox + 55, oy - Math.round(0.15 * ch)],
    [ox + 105, oy - Math.round(0.12 * ch)],
    [ox + 155, oy - Math.round(0.4 * ch)],
    [ox + 205, oy - Math.round(0.35 * ch)],
    [ox + 250, oy - Math.round(0.75 * ch)],
    [x + w - 22, oy - Math.round(0.95 * ch)],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    c.line(ax, ay, bx, by, RED);
    c.line(ax, ay + 1, bx, by + 1, RED);
    c.line(ax, ay - 1, bx, by - 1, RED);
  }
  // arrowhead at the end
  const [lx, ly] = pts[pts.length - 1];
  c.line(lx, ly, lx - 14, ly + 2, RED);
  c.line(lx, ly, lx - 4, ly + 13, RED);
  c.text(x + 8, y + 4, "+33%", 3, RED);
}

function artGlobe(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, CREAM);
  const cx = x + 90;
  const cy = y + h / 2 + 2;
  const r = 20;
  c.circle(cx, cy, r, BLUE, false);
  c.circle(cx, cy, r, SEA, true);
  // latitude / longitude lines
  c.hline(cx - r, cy, r * 2, SEA_DARK);
  c.vline(cx, cy - r, r * 2, SEA_DARK);
  c.line(cx - 14, cy - 14, cx + 14, cy + 14, SEA_DARK);
  c.line(cx + 14, cy - 14, cx - 14, cy + 14, SEA_DARK);
  // land blobs
  c.poly(
    [
      [cx - 13, cy - 10],
      [cx - 3, cy - 13],
      [cx + 2, cy - 5],
      [cx - 6, cy - 2],
    ],
    LAND_DARK,
  );
  c.poly(
    [
      [cx + 3, cy + 5],
      [cx + 13, cy + 2],
      [cx + 14, cy + 11],
      [cx + 5, cy + 14],
    ],
    LAND_DARK,
  );
  // red crack across the globe
  const crack: Array<[number, number]> = [
    [cx - 17, cy - 16],
    [cx - 8, cy - 6],
    [cx - 13, cy + 2],
    [cx - 2, cy + 8],
    [cx - 7, cy + 16],
    [cx + 5, cy + 21],
  ];
  for (let i = 0; i + 1 < crack.length; i++) {
    c.line(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], RED);
    c.line(crack[i][0] + 1, crack[i][1], crack[i + 1][0] + 1, crack[i + 1][1], RED);
  }
  // NO DEAL stamp, bottom right; place label top left
  c.text(x + 6, y + 6, "ANTALYA", 2, INK, 0);
  const sx = x + 170;
  const sy = y + h - 24;
  c.box(sx, sy, 132, 22, RED);
  c.text(sx + 8, sy + 4, "NO DEAL", 2, RED, 0);
}

// Simplified world map: stylised continents in a wide strip.
function drawWorldMap(c: Canvas, x0: number, y0: number): void {
  c.rect(x0, y0, CW, 60, SEA);
  c.box(x0, y0, CW, 60, GREY);
  const P = (pts: Array<[number, number]>): Array<[number, number]> =>
    pts.map(([px, py]) => [x0 + px, y0 + py] as [number, number]);
  // North America
  c.poly(
    P([
      [44, 6],
      [134, 2],
      [219, 6],
      [239, 17],
      [199, 26],
      [159, 37],
      [109, 34],
      [59, 25],
    ]),
    LAND,
  );
  // Greenland
  c.poly(
    P([
      [239, 2],
      [259, 0],
      [264, 6],
      [246, 9],
    ]),
    LAND,
  );
  // South America
  c.poly(
    P([
      [239, 31],
      [284, 28],
      [299, 40],
      [274, 59],
      [246, 49],
    ]),
    LAND,
  );
  // Europe
  c.poly(
    P([
      [464, 6],
      [509, 3],
      [529, 12],
      [504, 23],
      [474, 20],
    ]),
    LAND,
  );
  // Africa
  c.poly(
    P([
      [464, 26],
      [529, 23],
      [549, 37],
      [514, 59],
      [479, 54],
      [459, 39],
    ]),
    LAND,
  );
  // Asia
  c.poly(
    P([
      [534, 3],
      [684, 0],
      [754, 8],
      [739, 26],
      [684, 34],
      [624, 29],
      [579, 22],
      [544, 14],
    ]),
    LAND,
  );
  // South-East Asia islands
  c.poly(
    P([
      [700, 40],
      [730, 39],
      [738, 45],
      [712, 48],
    ]),
    LAND,
  );
  c.poly(
    P([
      [744, 43],
      [762, 42],
      [766, 46],
      [750, 49],
    ]),
    LAND,
  );
  // Australia
  c.poly(
    P([
      [754, 42],
      [809, 39],
      [822, 51],
      [779, 57],
      [752, 49],
    ]),
    LAND,
  );
  // numbered story dots
  for (const d of MAP_DOTS) {
    c.circle(d.x, d.y, 7, RED, true);
    c.circle(d.x, d.y, 7, WHITE, false);
    c.text(d.x - 2, d.y - 3, String(d.n), 1, WHITE, 0);
  }
}

// ------------------------------------------------------------- render --
function render(): Canvas {
  const c = new Canvas();
  c.box(4, 4, 1016, 1016, INK);
  c.hline(4, 6, 1016, INK);

  // Masthead
  c.textCentred(512, 12, "THE WORLD IN ONE DAY", 7, INK, 0);
  c.textCentred(512, 66, "MONDAY 23 NOVEMBER 2026", 3, RED, 0);
  c.hline(MX, 92, CW, INK, 2);
  c.hline(MX, 96, CW, INK, 1);

  // Timeline strip
  c.text(MX, 94, "THE DAY IN UTC", 2, RED, 0);
  c.text(MX + 170, 94, "MONDAY 23 NOVEMBER 2026, ALL TIMES UTC", 2, GREY, 0);
  for (let i = 0; i < TIMELINE.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = MX + col * 248;
    const y = 112 + row * 16;
    const [time, label] = TIMELINE[i];
    c.text(x, y, time, 2, RED, 0);
    c.text(x + 62, y, label, 2, INK, 0);
  }
  c.hline(MX, 146, CW, INK, 1);

  // Big numbers strip
  for (let i = 0; i < BIG_NUMBERS.length; i++) {
    const [num, label] = BIG_NUMBERS[i];
    const cx = MX + i * 165 + 82;
    c.textCentred(cx, 152, num, 4, RED);
    c.textCentred(cx, 184, label, 2, INK, 0);
    if (i > 0) c.vline(MX + i * 165, 150, 46, GREY);
  }
  c.hline(MX, 202, CW, INK, 2);

  // Three lead stories
  const leadXs = [MX, 352, 688];
  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    const x = leadXs[i];
    const w = 320;
    c.text(x, 206, lead.kicker, 2, RED, 0);
    const headLines = wrap(lead.headline, w, 3, 0, 3);
    let hy = 224;
    for (const line of headLines) {
      c.text(x, hy, line, 3, INK, 0);
      hy += 23;
    }
    const artY = hy + 6;
    const artH = 326 - artY;
    c.box(x, artY, w, artH, GREY);
    if (lead.art === "sea") artSea(c, x + 1, artY + 1, w - 2, artH - 2);
    if (lead.art === "chart") artChart(c, x + 1, artY + 1, w - 2, artH - 2);
    if (lead.art === "globe") artGlobe(c, x + 1, artY + 1, w - 2, artH - 2);
    const bodyLines = wrap(lead.body, w, 2, 0, 5);
    let by = 332;
    for (const line of bodyLines) {
      c.text(x, by, line, 2, INK, 0);
      by += 15;
    }
    drawBadge(c, x, 414, lead.badge, lead.sources);
    if (i > 0) c.vline(x - 8, 206, 226, GREY);
  }
  c.hline(MX, 438, CW, INK, 2);

  // Ten middle stories, two columns of five
  c.text(MX, 444, "MORE OF THE DAY - TEN STORIES", 2, RED, 0);
  for (let i = 0; i < MIDDLE.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MX + col * 504;
    const y = 464 + row * 45;
    const m = MIDDLE[i];
    const head = truncate(`${i + 1}. ${m.headline}`, 488, 2, 0);
    c.text(x, y, head, 2, INK, 0);
    const body = truncate(m.body, 488, 2, 0);
    c.text(x, y + 15, body, 2, INK, 0);
    c.text(x, y + 30, `${m.badge} \u2022 ${m.sources}`, 2, RED, 0);
  }
  c.hline(MX, 693, CW, INK, 1);

  // World map
  c.text(MX, 699, "WHERE IT HAPPENED", 2, RED, 0);
  drawWorldMap(c, MX, 717);
  c.textCentred(512, 781, MAP_LEGEND, 2, INK, 0);
  c.hline(MX, 799, CW, INK, 1);

  // ALSO list, two columns
  c.text(MX, 805, "ALSO ON MONDAY", 2, RED, 0);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < 10 ? 0 : 1;
    const row = i < 10 ? i : i - 10;
    const x = MX + col * 504;
    const y = 825 + row * 15;
    const item = truncate(`${i + 1}. ${ALSO[i]}`, 488, 2, 0);
    c.text(x, y, item, 2, INK, 0);
  }
  c.hline(MX, 979, CW, INK, 1);

  // Footer: date check
  c.text(MX, 985, FOOTER_1, 2, RED, 0);
  c.text(MX, 1001, FOOTER_2, 2, INK, 0);
  return c;
}

// ---------------------------------------------------------------- main --
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(render());
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
