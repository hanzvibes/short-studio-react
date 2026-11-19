"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRIDGE,
  OBJECTS,
  applyEdits,
  clamp,
  crossCheckProps,
  fmt,
  fmt1,
  fmtTC,
  pad,
  parseCaps,
  parseDefaults,
  parseProps,
  parseShots,
  parseVO,
  rewriteThreeCdnToLocal,
  setCaps as writeCaps,
  setProps as writeProps,
  setShots as writeShots,
  setText,
  setVO as writeVO,
  slug,
  SPK,
  TEMPLATES,
  validateCaps,
  validateProps,
  validateShots,
  voKind,
  type Cap,
  type EditSpec,
  type PropDef,
  type PropValue,
  type PropValues,
  type Shot,
  type TemplateEntry,
  type TextFields,
  type VoKind,
} from "../lib/studio";

const FPS = 60;
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  volOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  volOff: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
};

type Sel = { kind: "shot" | "cap"; i: number } | null;
type Status = "load" | "ok" | "err";

/** Edit lengkap per template (teks + caps + shots + VO + props), tersimpan
 *  di localStorage kunci "ss.edits.v1". Hanya selisih dari aslinya yang
 *  disimpan (caps/shots/props bila berubah; vo hanya bila diedit manual). */
interface FullEdit {
  text?: TextFields;
  caps?: Cap[];
  shots?: Shot[];
  vo?: string[];
  voTouched?: boolean;
  props?: PropValues;
}

/** Entri "Video Buatan Saya": video baru dari satu template asal + edit
 *  tersimpan. TIDAK PERNAH menimpa 12 template asli. localStorage "ss.mine.v1". */
interface MyVideo {
  id: string;
  label: string;
  file: string;
  title: string;
  sub: string;
  end: string;
  caps?: Cap[];
  shots?: Shot[];
  vo?: string[];
  props?: PropValues;
  createdAt: number;
  /** Terakhir diperbarui lewat simpan-ulang (U4); kosong = belum pernah diperbarui. */
  updatedAt?: number;
}

const EDITS_KEY = "ss.edits.v1";
const MINE_KEY = "ss.mine.v1";

/** Tulis satu kunci localStorage; kembalikan false bila gagal (penyimpanan
 *  penuh, mode privat, …). Pemanggil KRITIS (edit, Video Buatan Saya)
 *  HARUS memakai hasilnya — kegagalan tidak boleh ditelan diam-diam
 *  lalu diklaim sukses (U5: toast "diterapkan"/"disimpan" palsu).
 *  Kunci NON-KRITIS (tema, drawer, template terakhir, zoom, tur) SENGAJA
 *  tetap diam-diam bila gagal: yang hilang hanya preferensi tampilan,
 *  dan toast error yang menakutkan di tiap ganti tema lebih buruk daripada
 *  preferensi yang tidak bertahan. Tulis-tulis itu juga kecil dan
 *  menggantikan nilai lama dengan ukuran sama, jadi biasanya tetap lolos
 *  walau penyimpanan hampir penuh. */
function writeLS(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Pesan awam saat tulis penyimpanan gagal karena penuh (U5). Bahasa
 *  awam, tanpa istilah teknis ("kuota", "localStorage", "QuotaExceeded").
 *  Tiap pesan menyebut APA yang belum tersimpan + APA yang harus dilakukan
 *  pengguna (hapus sebagian video tersimpan — itulah isi terbesar yang
 *  bisa dikosongkan dari dalam aplikasi). */
const ERR_EDIT = "Penyimpanan penuh, edit belum tersimpan — hapus sebagian video tersimpan dulu";
const ERR_RESET = "Penyimpanan penuh, kembalian belum tersimpan — hapus sebagian video tersimpan dulu";
const ERR_DRAFT = "Penyimpanan penuh, draf belum tersimpan — hapus sebagian video tersimpan dulu";
const ERR_MINE_SAVE = "Penyimpanan penuh, video belum tersimpan — hapus sebagian video tersimpan dulu";
const ERR_MINE_DELETE = "Penyimpanan penuh, video belum terhapus — hapus sebagian video tersimpan dulu";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "video-saya";

const TOUR_STEPS = [
  { el: "#drawer", t: "Project bin", p: "Semua 12 short ada di panel kiri. Cari lewat kolom pencarian; teks yang sudah diedit ditandai titik biru." },
  { el: ".viewer", t: "Viewer 9:16", p: "Komposisi 1080×1920. Klik preview atau Space untuk memutar. Garis bantu aman bisa dinyalakan lewat ikon grid atau tombol G." },
  { el: ".timeline", t: "Timeline ala NLE", p: "V1 berisi shot, T1 caption per pembicara, A1 narasi. Klik klip untuk memilih, seret ruler untuk scrub, dan atur zoom di kanan atas." },
  { el: ".inspector", t: "Inspector", p: "Ubah judul, subjudul, dan end card di tab Teks, lalu Terapkan (Ctrl+Enter). Tab Shot, Caption, dan Objek menampilkan klip dan objek yang bisa diedit — semua diterapkan bersamaan." },
  { el: ".tb-actions", t: "Perintah cepat", p: "Ctrl+K membuka palet perintah, D mengganti tema, dan Ekspor membuatkan perintah MP4. Tekan ? untuk semua pintasan." },
];

/** Zona ketuk-objek-di-preview per template (tata letak shot lebar,
 *  koordinat 0..1 dari kiri atas). Tebakan terbaik saja: shot close-up
 *  bisa berbeda susunannya, dan objek kecil (cangkir, lampu, jendela)
 *  sengaja tidak punya zona — daftar objek di tab Objek selalu bisa
 *  diandalkan. Zona diperiksa berurutan; yang pertama cocok menang. */
const CLICK_ZONES: Record<string, { x0: number; x1: number; y0: number; y1: number; obj: string }[]> = {
  "template.html": [
    { x0: 0.3, x1: 0.7, y0: 0.02, y1: 0.2, obj: "board" },
    { x0: 0.02, x1: 0.48, y0: 0.35, y1: 0.95, obj: "claude" },
    { x0: 0.52, x1: 0.98, y0: 0.35, y1: 0.95, obj: "codex" },
  ],
  "template-trio.html": [
    { x0: 0.3, x1: 0.7, y0: 0.02, y1: 0.2, obj: "board" },
    { x0: 0.02, x1: 0.36, y0: 0.35, y1: 0.95, obj: "claude" },
    { x0: 0.36, x1: 0.64, y0: 0.3, y1: 0.9, obj: "gemini" },
    { x0: 0.64, x1: 0.98, y0: 0.35, y1: 0.95, obj: "codex" },
  ],
  "template-code.html": [
    { x0: 0.3, x1: 0.7, y0: 0.02, y1: 0.2, obj: "board" },
    { x0: 0.02, x1: 0.48, y0: 0.35, y1: 0.95, obj: "claude" },
    { x0: 0.52, x1: 0.98, y0: 0.35, y1: 0.95, obj: "codex" },
  ],
  "template-kuota.html": [
    { x0: 0.3, x1: 0.7, y0: 0.02, y1: 0.2, obj: "board" },
    { x0: 0.38, x1: 0.62, y0: 0.3, y1: 0.75, obj: "tank" },
    { x0: 0.02, x1: 0.38, y0: 0.35, y1: 0.95, obj: "claude" },
    { x0: 0.62, x1: 0.98, y0: 0.35, y1: 0.95, obj: "codex" },
  ],
  "template-rival.html": [
    { x0: 0.3, x1: 0.7, y0: 0.02, y1: 0.2, obj: "board" },
    { x0: 0.02, x1: 0.48, y0: 0.35, y1: 0.95, obj: "claude" },
    { x0: 0.52, x1: 0.98, y0: 0.35, y1: 0.95, obj: "codex" },
  ],
  "template-perang.html": [
    { x0: 0.35, x1: 0.65, y0: 0.02, y1: 0.22, obj: "war" },
    { x0: 0.02, x1: 0.3, y0: 0.4, y1: 0.9, obj: "fort" },
    { x0: 0.7, x1: 0.98, y0: 0.4, y1: 0.9, obj: "fort" },
    { x0: 0.3, x1: 0.5, y0: 0.4, y1: 0.9, obj: "claude" },
    { x0: 0.5, x1: 0.7, y0: 0.4, y1: 0.9, obj: "codex" },
  ],
  "template-typing.html": [
    { x0: 0.1, x1: 0.9, y0: 0.03, y1: 0.3, obj: "screen" },
    { x0: 0.25, x1: 0.75, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
  "template-deploy.html": [
    { x0: 0.1, x1: 0.9, y0: 0.03, y1: 0.3, obj: "screen" },
    { x0: 0.25, x1: 0.75, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
  "template-bughunter.html": [
    { x0: 0.1, x1: 0.9, y0: 0.03, y1: 0.3, obj: "screen" },
    { x0: 0.25, x1: 0.75, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
  "template-bomb.html": [
    { x0: 0.1, x1: 0.9, y0: 0.03, y1: 0.3, obj: "screen" },
    { x0: 0.25, x1: 0.75, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
  "template-meeting.html": [
    { x0: 0.1, x1: 0.9, y0: 0.03, y1: 0.3, obj: "screen" },
    { x0: 0.25, x1: 0.75, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
  "template-sleep.html": [
    { x0: 0.68, x1: 0.98, y0: 0.3, y1: 0.85, obj: "boss" },
    { x0: 0.15, x1: 0.68, y0: 0.3, y1: 0.95, obj: "claude" },
  ],
};

/** Petakan ketukan preview (x, y ternormalisasi) ke kunci objek, atau
 *  null bila tidak ada zona yang cocok / objeknya tidak ada di template
 *  ini. `avail` = kunci objek yang punya minimal satu pengaturan. */
function pickObjAt(file: string, x: number, y: number, avail: Set<string>): string | null {
  const zones = CLICK_ZONES[file] || [];
  for (const z of zones) {
    if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && avail.has(z.obj)) return z.obj;
  }
  return null;
}

/** Buang awalan "id pengaturan:" dari pesan error supaya yang tampil
 *  hanya kalimat awamnya (pemetaan ke baris sudah dilakukan pemanggil). */
const stripPropId = (e: string) => e.replace(/^[\w.]+( dan [\w.]+)?:\s*/, "");

/** Pilihan wajah maskot biru di layar (face.codex): -1 = ikut cerita. */
const FACE_CHOICES: { v: number; label: string }[] = [
  { v: -1, label: "Ikut cerita" },
  { v: 0, label: "Biasa" },
  { v: 1, label: "Marah" },
  { v: 2, label: "Senang" },
  { v: 3, label: "Lelah" },
];

/** Label tiga angka di papan skor (urutan sama seperti di template). */
const SCORE_LABELS = ["Kebersihan", "Tes lulus", "Performa"];

/** Rentang slider untuk satu pengaturan (rentang per template bila ada). */
function rangeOf(def: PropDef, file: string): { min: number; max: number; step: number } {
  const r = def.rangeByFile?.[file];
  return r ?? { min: def.min ?? 0, max: def.max ?? 0, step: def.step ?? 0.05 };
}
/** Tampilkan nilai slider dengan satuan yang dimengerti. */
function fmtSliderVal(v: number, def: PropDef, file: string): string {
  const r = rangeOf(def, file);
  const num = Number.isInteger(r.step) ? String(Math.round(v)) : v.toFixed(2);
  return def.unit ? `${num} ${def.unit}` : num;
}

/** Satu baris kontrol slider angka + tombol kembali ke asli. */
function ObjSlider({ def, file, value, orig, err, onNum }: {
  def: PropDef; file: string; value: number; orig: PropValue | undefined; err?: string[]; onNum: (v: number) => void;
}) {
  const r = rangeOf(def, file);
  const changed = JSON.stringify(value) !== JSON.stringify(orig);
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h">
        <span>{def.plain}</span>
        <b>{fmtSliderVal(value, def, file)}</b>
        {changed && typeof orig === "number" && (
          <button className="btn ghost small" title="Kembalikan ke nilai asli" onClick={() => onNum(orig)}>↺</button>
        )}
      </div>
      <input type="range" min={r.min} max={r.max} step={r.step} value={value} aria-label={def.plain}
        onChange={(e) => onNum(parseFloat(e.target.value))} />
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Lima tombol pilihan wajah maskot biru di layar. */
function ObjChoice({ def, value, err, onNum }: {
  def: PropDef; value: number; err?: string[]; onNum: (v: number) => void;
}) {
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span></div>
      <div className="choice-row" role="group" aria-label={def.plain}>
        {FACE_CHOICES.map((c) => (
          <button key={c.v} type="button" className={`choice${value === c.v ? " on" : ""}`} aria-pressed={value === c.v}
            onClick={() => onNum(c.v)}>{c.label}</button>
        ))}
      </div>
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Pemilih warna saja (tanpa kode hex). */
function ObjColor({ def, value, err, onVal }: {
  def: PropDef; value: string; err?: string[]; onVal: (v: string) => void;
}) {
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span>
        <span className="prop-color">
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#d97757"} aria-label={def.plain}
            onChange={(e) => onVal(e.target.value)} />
        </span>
      </div>
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Input teks (atau area teks besar untuk isi layar editor). */
function ObjText({ def, value, err, onVal }: {
  def: PropDef; value: string; err?: string[]; onVal: (v: string) => void;
}) {
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span></div>
      {def.control === "textarea" ? (
        <textarea rows={8} spellCheck={false} value={value} aria-label={def.plain} onChange={(e) => onVal(e.target.value)} />
      ) : (
        <input type="text" value={value} aria-label={def.plain} onChange={(e) => onVal(e.target.value)} />
      )}
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Tiga slider skor papan (Kebersihan / Tes lulus / Performa). */
function ObjScores({ def, value, err, onArr }: {
  def: PropDef; value: number[]; err?: string[]; onArr: (v: unknown[]) => void;
}) {
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span></div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="prop-sub">
          <div className="prop-ctl-h"><span>{SCORE_LABELS[i]}</span><b>{Math.round(value[i] ?? 0)}</b></div>
          <input type="range" min={0} max={100} step={1} value={value[i] ?? 0} aria-label={`${def.plain} — ${SCORE_LABELS[i]}`}
            onChange={(e) => { const next = [...value]; next[i] = parseFloat(e.target.value); onArr(next); }} />
        </div>
      ))}
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Kurva tangki kuota: baris [detik, persen] dengan dua slider.
 *  Baris pertama selalu detik 0 (tangki mulai penuh); slider detik
 *  dijepit ke baris tetangga supaya urutan tetap naik. */
function ObjCurve({ def, value, len, err, onArr }: {
  def: PropDef; value: number[][]; len: number; err?: string[]; onArr: (v: unknown[]) => void;
}) {
  const setCell = (i: number, k: 0 | 1, v: number) => {
    const next = value.map((r) => [...r]);
    next[i][k] = v;
    onArr(next);
  };
  const last = value[value.length - 1];
  const canAdd = value.length > 0 && last && last[0] < len - 0.1;
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span><em>{value.length} baris</em></div>
      {value.map((row, i) => {
        const prev = i > 0 ? value[i - 1][0] : 0;
        const nxt = i + 1 < value.length ? value[i + 1][0] : len;
        const lo = i === 0 ? 0 : Math.min(prev + 0.1, nxt - 0.1);
        const hi = Math.max(lo, nxt - 0.1);
        return (
          <div key={i} className="prop-sub">
            <div className="prop-ctl-h"><span>Baris {i + 1}</span>
              {i > 0 && value.length > 2 && (
                <button className="btn ghost small" title="Hapus baris ini" onClick={() => onArr(value.filter((_, j) => j !== i))}>Hapus</button>
              )}
            </div>
            <div className="prop-ctl-h"><span>Detik</span><b>{row[0].toFixed(1)} dtk</b></div>
            {i === 0 ? (
              <p className="prop-hint">Baris pertama selalu detik 0 — tangki mulai penuh.</p>
            ) : (
              <input type="range" min={lo} max={hi} step={0.1} value={row[0]} aria-label={`Baris ${i + 1} detik`}
                onChange={(e) => setCell(i, 0, parseFloat(e.target.value))} />
            )}
            <div className="prop-ctl-h"><span>Sisa kuota</span><b>{Math.round(row[1])}%</b></div>
            <input type="range" min={0} max={100} step={1} value={row[1]} aria-label={`Baris ${i + 1} sisa kuota`}
              onChange={(e) => setCell(i, 1, parseFloat(e.target.value))} />
          </div>
        );
      })}
      <button className="btn ghost small" disabled={!canAdd} onClick={() => { if (last) onArr([...value, [Math.round((last[0] + 1) * 10) / 10, last[1]]]); }}>+ Tambah baris</button>
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Jendela ketik: baris [mulai, selesai] dengan dua slider.
 *  Slider dijepit ke baris tetangga supaya tidak tumpang tindih. */
function ObjWindows({ def, value, len, err, onArr }: {
  def: PropDef; value: number[][]; len: number; err?: string[]; onArr: (v: unknown[]) => void;
}) {
  const setCell = (i: number, k: 0 | 1, v: number) => {
    const next = value.map((r) => [...r]);
    next[i][k] = v;
    onArr(next);
  };
  const last = value[value.length - 1];
  const canAdd = value.length > 0 && last && last[1] < len - 0.2;
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span><em>{value.length} baris</em></div>
      {value.map((row, i) => {
        const prevEnd = i > 0 ? value[i - 1][1] : 0;
        const nextStart = i + 1 < value.length ? value[i + 1][0] : len;
        return (
          <div key={i} className="prop-sub">
            <div className="prop-ctl-h"><span>Baris {i + 1}</span>
              {value.length > 1 && (
                <button className="btn ghost small" title="Hapus baris ini" onClick={() => onArr(value.filter((_, j) => j !== i))}>Hapus</button>
              )}
            </div>
            <div className="prop-ctl-h"><span>Mulai</span><b>{row[0].toFixed(1)} dtk</b></div>
            <input type="range" min={prevEnd} max={Math.max(prevEnd, row[1] - 0.1)} step={0.1} value={row[0]} aria-label={`Baris ${i + 1} mulai`}
              onChange={(e) => setCell(i, 0, parseFloat(e.target.value))} />
            <div className="prop-ctl-h"><span>Selesai</span><b>{row[1].toFixed(1)} dtk</b></div>
            <input type="range" min={Math.min(row[0] + 0.1, nextStart)} max={nextStart} step={0.1} value={row[1]} aria-label={`Baris ${i + 1} selesai`}
              onChange={(e) => setCell(i, 1, parseFloat(e.target.value))} />
          </div>
        );
      })}
      <button className="btn ghost small" disabled={!canAdd} onClick={() => { if (last) onArr([...value, [Math.round((last[1] + 0.1) * 10) / 10, Math.min(len, Math.round((last[1] + 1) * 10) / 10)]]); }}>+ Tambah baris</button>
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Waktu pasukan muncul: dua daftar slider detik (oranye / biru). */
function ObjSpawns({ def, value, len, err, onArr }: {
  def: PropDef; value: number[][]; len: number; err?: string[]; onArr: (v: unknown[]) => void;
}) {
  const sides = ["Pasukan oranye", "Pasukan biru"] as const;
  const setCell = (side: 0 | 1, i: number, v: number) => {
    const next = [[...value[0]], [...value[1]]];
    next[side][i] = v;
    onArr(next);
  };
  const add = (side: 0 | 1) => {
    const row = value[side];
    const lastV = row.length ? row[row.length - 1] : 0;
    const next = [[...value[0]], [...value[1]]];
    next[side] = [...row, Math.min(len, Math.round((lastV + 0.5) * 10) / 10)];
    onArr(next);
  };
  const remove = (side: 0 | 1, i: number) => {
    const next = [[...value[0]], [...value[1]]];
    next[side] = next[side].filter((_, j) => j !== i);
    onArr(next);
  };
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span></div>
      {([0, 1] as const).map((side) => {
        const row = value[side] || [];
        const canAdd = row.length < 8 && (row.length === 0 || row[row.length - 1] < len - 0.1);
        return (
          <div key={side} className="prop-sub">
            <div className="prop-ctl-h"><span>{sides[side]}</span><em>{row.length} kali</em></div>
            {row.map((t, i) => {
              const lo = i > 0 ? row[i - 1] + 0.1 : 0;
              const hi = i + 1 < row.length ? row[i + 1] - 0.1 : len;
              return (
                <div key={i}>
                  <div className="prop-ctl-h"><span>Muncul ke-{i + 1}</span><b>{t.toFixed(1)} dtk</b>
                    {row.length > 1 && (
                      <button className="btn ghost small" title="Hapus waktu ini" onClick={() => remove(side, i)}>Hapus</button>
                    )}
                  </div>
                  <input type="range" min={Math.min(lo, hi)} max={Math.max(lo, hi)} step={0.1} value={t} aria-label={`${sides[side]} muncul ke-${i + 1}`}
                    onChange={(e) => setCell(side, i, parseFloat(e.target.value))} />
                </div>
              );
            })}
            <button className="btn ghost small" disabled={!canAdd} onClick={() => add(side)}>+ Tambah waktu muncul</button>
          </div>
        );
      })}
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Daftar baris teks (kode / perintah / pesan): satu baris per baris. */
function ObjLines({ def, value, err, onArr }: {
  def: PropDef; value: string[]; err?: string[]; onArr: (v: unknown[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => { setText(value.join("\n")); }, [value]);
  return (
    <div className={`prop-ctl${err?.length ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span><em>{value.length} baris</em></div>
      <textarea rows={Math.min(10, Math.max(3, value.length + 1))} spellCheck={false} value={text} aria-label={def.plain}
        onChange={(e) => { setText(e.target.value); onArr(e.target.value.split("\n")); }} />
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      {err?.map((e, k) => <p key={k} className="valid-err row-err">{stripPropId(e)}</p>)}
    </div>
  );
}

/** Daftar yang masih ditulis sebagai teks (catatan tempel, ketapel,
 *  obrolan, tahapan, warna tombol, baris ketikan): penjelasan awam +
 *  error bila bentuknya tidak sesuai. */
function ObjJson({ def, text, err, onText }: {
  def: PropDef; text: string; err?: string; onText: (t: string) => void;
}) {
  return (
    <div className={`prop-ctl${err ? " err" : ""}`}>
      <div className="prop-ctl-h"><span>{def.plain}</span></div>
      <textarea rows={6} spellCheck={false} value={text} aria-label={def.plain} onChange={(e) => onText(e.target.value)} />
      {def.hint && <em className="prop-hint">{def.hint}</em>}
      <em className="prop-hint">Tulis sebagai daftar seperti nilai aslinya — salah ketik akan ditolak dan Terapkan ditahan.</em>
      {err && <em className="valid-err">{err}</em>}
    </div>
  );
}

export default function Studio() {
  const [cur, setCur] = useState<TemplateEntry>(TEMPLATES[0]);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [base, setBase] = useState("");
  const [def, setDef] = useState<TextFields>({ title: "", sub: "", end: "" });
  const [fields, setFields] = useState<TextFields>({ title: "", sub: "", end: "" });
  const [applied, setApplied] = useState<TextFields>({ title: "", sub: "", end: "" });
  const [edits, setEdits] = useState<Record<string, TextFields>>({});
  // Hydration: JANGAN baca localStorage di initializer. Server selalu
  // me-render [] / {} (localStorage tidak ada saat SSR); bila klien
  // menginisialisasi dari simpanan, HTML awal berbeda -> React #418
  // pada setiap load bagi pengguna yang pernah menyimpan video/edit.
  // Nilai awal kosong (identik dengan server), simpanan dimuat lewat
  // efek mount di bawah (lihat "restore simpanan") dan init template
  // baru jalan sesudah restored=true, supaya load() pertama sudah
  // melihat fullEdits yang dipulihkan.
  const [fullEdits, setFullEdits] = useState<Record<string, FullEdit>>({});
  const [mine, setMine] = useState<MyVideo[]>([]);
  const [restored, setRestored] = useState(false);
  const [activeMineId, setActiveMineId] = useState<string | null>(null);
  const [saveMineOpen, setSaveMineOpen] = useState(false);
  const [saveMineLabel, setSaveMineLabel] = useState("");
  // Draft edit caption/shot/props (state edit, bukan langsung ke template).
  const [origCaps, setOrigCaps] = useState<Cap[] | null>(null);
  const [origShots, setOrigShots] = useState<Shot[] | null>(null);
  const [origVO, setOrigVO] = useState<string[] | null>(null);
  const [voKindState, setVoKindState] = useState<VoKind>("none");
  const [hasSpeaker, setHasSpeaker] = useState(false);
  const [draftCaps, setDraftCaps] = useState<Cap[]>([]);
  const [draftShots, setDraftShots] = useState<Shot[]>([]);
  const [draftVO, setDraftVO] = useState<string[] | null>(null);
  const [voTouched, setVoTouched] = useState(false);
  const [origProps, setOrigProps] = useState<PropValues>({});
  const [draftProps, setDraftProps] = useState<PropValues>({});
  // Baseline "terakhir diterapkan" untuk caption/shot/props/VO — cermin
  // `applied` pada teks (bandingkan `dirty`, yang memakai `applied`,
  // bukan `def`). `orig*` TETAP baseline template asli: ia dipakai
  // persistensi ss.edits.v1 (saveCurrentFullEdit), tombol "Kembalikan",
  // ekspor .html, dan Video Buatan Saya — semuanya membandingkan draft
  // vs ASLI. Yang dibandingkan ke tombol Terapkan + baris status adalah
  // baseline ini, supaya sesudah apply tombol kembali disabled dan
  // status kembali "Tidak ada perubahan". Meng-update orig* langsung
  // justru akan menghapus edit tersimpan pada saveCurrentFullEdit()
  // berikutnya (draft == orig -> entri dihapus dari ss.edits.v1, edit
  // hilang saat ganti template) dan membuat ekspor/Video Buatan Saya
  // kehilangan edit yang sudah diterapkan.
  const [appliedCaps, setAppliedCaps] = useState<Cap[] | null>(null);
  const [appliedShots, setAppliedShots] = useState<Shot[] | null>(null);
  const [appliedVO, setAppliedVO] = useState<string[] | null>(null);
  const [appliedProps, setAppliedProps] = useState<PropValues>({});
  const [propsAvail, setPropsAvail] = useState<{ def: PropDef; value: PropValue }[]>([]);
  /** Objek yang sedang dipilih di tab Objek (kunci OBJECTS, mis. "claude").
   *  null = ikut objek pertama yang ada di template ini. */
  const [selObj, setSelObj] = useState<string | null>(null);
  /** Teks mentah field JSON untuk prop array (tank.curve, rival.notes,
   *  dsb.) + error parse/validasi per prop. Nilai yang lolos validasi
   *  masuk draftProps; yang tidak lolos menahan Terapkan (lihat arrayErr
   *  di allErrors). */
  const [arrayText, setArrayText] = useState<Record<string, string>>({});
  const [arrayErr, setArrayErr] = useState<Record<string, string>>({});
  const [len, setLen] = useState(30);
  const [shots, setShots] = useState<Shot[]>([]);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loopOn, setLoopOn] = useState(true);
  const [sel, setSel] = useState<Sel>(null);
  const [tab, setTab] = useState<"teks" | "shot" | "cap" | "objek">("teks");
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  /** Cermin sinkron dari `ready` (state React). `ready` di closure bisa
   *  basi satu tick sesudah setReady(false) — padahal bridge BARU sudah
   *  ada (`__st` terpasang) tapi belum di-seek (gT()=0). mount() dan sync
   *  loop memakai ref ini supaya tidak pernah membaca 0 dari bridge
   *  yang belum siap (U6/F2). Diperbarui di SETIAP situs setReady. */
  const readyRef = useRef(false);
  const [status, setStatus] = useState<Status>("load");
  const [statusText, setStatusText] = useState("Memuat…");
  const [statusInfo, setStatusInfo] = useState("Memuat project…");
  const [skelText, setSkelText] = useState("Menyiapkan preview…");
  const [skelWhy, setSkelWhy] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  /** Toast sedang menampilkan pesan ERROR (U5): tampil merah supaya
   *  terbedakan dari toast sukses biasa; hilang otomatis sama seperti
   *  toast lain (timer yang sama, 2 dtk). */
  const [toastErr, setToastErr] = useState(false);
  const [tlPps, setTlPps] = useState(20);
  const [tlFit, setTlFit] = useState(true);
  const [tlContentW, setTlContentW] = useState(0);
  const [tlRange, setTlRange] = useState(0);
  const [snap, setSnap] = useState(true);
  const [vZoom, setVZoom] = useState(0);
  const [guides, setGuides] = useState(false);
  /** Mode fokus viewer: lipat timeline + transport + now-cap supaya stage
   *  9:16 mendapat seluruh tinggi workspace (lihat CSS .focus-view).
   *  Satu-satunya jalan di viewport pendek — stage sudah fit-to-height,
   *  yang kurang adalah ruangnya. Session-only, tidak disimpan. */
  const [focusView, setFocusView] = useState(false);
  const [fps, setFps] = useState(60);
  const [hiddenTracks, setHiddenTracks] = useState<Record<string, boolean>>({});
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdSel, setCmdSel] = useState(0);
  const [expOpen, setExpOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  // ---------- tumpukan lapis dialog/palet (G8/U12) ----------
  // Urutan = urutan DIBUKA (bukan prioritas tetap): Esc menutup dari atas
  // (LIFO) dan z-index mengikuti urutan ini, jadi lapis yang terakhir
  // dibuka selalu paling atas — palet tidak lagi selalu menutupi dialog.
  // Disinkronkan dari keempat boolean (satu efek, bukan di tiap situs
  // pemanggil) supaya urutan buka yang sebenarnya selalu terjaga.
  const layerStackRef = useRef<string[]>([]);
  const [layerStack, setLayerStack] = useState<string[]>([]);
  useEffect(() => {
    const want = [
      expOpen ? "exp" : null,
      saveMineOpen ? "save" : null,
      keysOpen ? "keys" : null,
      cmdOpen ? "cmd" : null,
    ].filter((x): x is string => x !== null);
    const prev = layerStackRef.current;
    const next = [...prev.filter((id) => want.includes(id)), ...want.filter((id) => !prev.includes(id))];
    if (next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
      layerStackRef.current = next;
      setLayerStack(next);
    }
  }, [expOpen, saveMineOpen, keysOpen, cmdOpen]);
  // Tutup lapis teratas; false bila tidak ada lapis terbuka.
  const closeTopLayer = useCallback(() => {
    const top = layerStackRef.current[layerStackRef.current.length - 1];
    if (!top) return false;
    if (top === "exp") setExpOpen(false);
    else if (top === "save") setSaveMineOpen(false);
    else if (top === "keys") setKeysOpen(false);
    else if (top === "cmd") setCmdOpen(false);
    return true;
  }, []);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourRect, setTourRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tourCardPos, setTourCardPos] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [tlHeight, setTlHeight] = useState(264);

  // ---------- bottom sheet inspector (portrait ≤900px) ----------
  /** Snap sheet: peek 148px / half min(46dvh,480px) / full 100dvh−76px / closed. */
  type SheetSnap = "peek" | "half" | "full" | "closed";
  const [sheetMode, setSheetMode] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  /** Lipatan timeline manual: null = ikut sheet (terlipat saat sheet
   *  terbuka), true = dibuka manual oleh pengguna. */
  const [tlManual, setTlManual] = useState<boolean | null>(null);
  const [sheetKbOpen, setSheetKbOpen] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startY: number; startTranslate: number; lastY: number; lastT: number; vy: number; moved: boolean; pointerId: number } | null>(null);
  const prevSnapRef = useRef<SheetSnap | null>(null);
  const prevTlHeightRef = useRef<number | null>(null);
  const kbOpenRef = useRef(false);
  const tlToastShownRef = useRef(false);
  const sheetSnapRef = useRef<SheetSnap>("peek");
  const sheetModeRef = useRef(false);
  const drawerOpenRef = useRef(drawerOpen);
  sheetSnapRef.current = sheetSnap;
  sheetModeRef.current = sheetMode;
  drawerOpenRef.current = drawerOpen;
  /** Timeline terlipat jadi strip saat sheet terbuka (kecuali dibuka manual). */
  const tlCollapsed = sheetMode && sheetSnap !== "closed" && tlManual !== true;
  const tlCollapsedRef = useRef(false);
  tlCollapsedRef.current = tlCollapsed;

  const openSheetIfClosed = useCallback((s: SheetSnap) => {
    if (sheetModeRef.current && sheetSnapRef.current === "closed") setSheetSnap(s);
  }, []);
  const closeSheet = useCallback(() => { setSheetSnap("closed"); }, []);
  const stepDownSnap = useCallback(() => {
    setSheetSnap((s) => (s === "full" ? "half" : s === "half" ? "peek" : "closed"));
  }, []);
  const toggleSheetSnap = useCallback(() => {
    setSheetSnap((s) => (s === "full" ? "half" : s === "peek" ? "half" : s === "half" ? "peek" : "peek"));
  }, []);
  const toggleTlFold = useCallback(() => {
    setTlManual((m) => (m === true ? null : true));
  }, []);
  const sheetHalfH = useCallback((fullH: number) => Math.min(window.innerHeight * 0.46, 480, fullH), []);

  /** Drag gagang/header: pointer events + pointer capture (bukan
   *  mouse-only). Selama drag, transform ditulis inline tanpa transisi;
   *  saat lepas, snap terdekat (atau satu snap searah fling ≥0,5 px/ms). */
  const onSheetDragStart = useCallback((e: React.PointerEvent) => {
    if (!sheetModeRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = sheetRef.current;
    if (!el) return;
    // Cegah aksi default mousedown (pindah fokus ke field pertama di
    // .panes + seleksi teks) selama drag — tanpa ini drag pakai mouse
    // memindahkan fokus ke kolom Judul/Subjudul.
    e.preventDefault();
    const fullH = el.offsetHeight;
    const visible = sheetSnapRef.current === "closed" ? 0 : sheetSnapRef.current === "peek" ? 148 : sheetSnapRef.current === "half" ? sheetHalfH(fullH) : fullH;
    dragRef.current = { startY: e.clientY, startTranslate: fullH - visible, lastY: e.clientY, lastT: performance.now(), vy: 0, moved: false, pointerId: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.style.transition = "none";
  }, [sheetHalfH]);
  const onSheetPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const el = sheetRef.current;
    if (!el) return;
    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.vy = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = now;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 6) drag.moved = true;
    const fullH = el.offsetHeight;
    el.style.transform = `translateY(${clamp(drag.startTranslate + dy, 0, fullH)}px)`;
  }, []);
  const onSheetPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    const el = sheetRef.current;
    if (!el) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const fullH = el.offsetHeight;
    const translate = clamp(drag.startTranslate + (e.clientY - drag.startY), 0, fullH);
    const visible = fullH - translate;
    const halfH = sheetHalfH(fullH);
    const snaps: SheetSnap[] = ["closed", "peek", "half", "full"];
    const heights = [0, 148, halfH, fullH];
    let idx = 0;
    let best = Infinity;
    heights.forEach((h, i) => {
      const d = Math.abs(visible - h);
      if (d < best) { best = d; idx = i; }
    });
    const curIdx = snaps.indexOf(sheetSnapRef.current);
    if (Math.abs(drag.vy) >= 0.5 && curIdx >= 0) {
      idx = drag.vy > 0 ? Math.max(0, curIdx - 1) : Math.min(snaps.length - 1, curIdx + 1);
    }
    // Ketuk (tanpa geser) pada gagang/header = Peek ↔ Half. Klik tidak
    // bisa diandalkan di sini: setPointerCapture mengalihkan event klik
    // ke aside sehingga onClick header tidak pernah sampai.
    if (!drag.moved) {
      toggleSheetSnap();
      return;
    }
    el.style.transition = "";
    el.style.transform = `translateY(${fullH - heights[idx]}px)`;
    setSheetSnap(snaps[idx]);
  }, [sheetHalfH, toggleSheetSnap]);
  /** Drag dibatalkan (mis. panggilan masuk): kembali ke snap semula
   *  tanpa toggle. */
  const onSheetPointerCancel = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    const el = sheetRef.current;
    if (!el) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    el.style.transition = "";
    el.style.transform = "";
  }, []);
  /** Field yang difokuskan di-scroll ke tengah area kelihatan saat
   *  keyboard terbuka (di dalam .panes, bukan dokumen). */
  const onSheetFocusCapture = useCallback((e: React.FocusEvent) => {
    if (!sheetModeRef.current || !kbOpenRef.current) return;
    const t = e.target as HTMLElement;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const scroll = () => t.scrollIntoView({ block: "center", behavior: "smooth" });
    scroll();
    setTimeout(scroll, 350);
  }, []);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerCanvasRef = useRef<HTMLDivElement>(null);
  const tlScrollRef = useRef<HTMLDivElement>(null);
  const tlContentRef = useRef<HTMLDivElement>(null);
  const loadIdRef = useRef(0);
  const rafRef = useRef(0);
  const seekGuardRef = useRef(false);
  const lastTRef = useRef(-1);
  /** Waktu video terakhir yang tercatat dari bridge (detik). Dipakai
   *  mount(keepTime=true) bila bridge belum siap (live reload) — bridge
   *  yang hilang mengembalikan 0 lewat gT(), dan 0 itu BUKAN waktu yang
   *  benar (akar U6/F2: t=15 ke-reset ke 0). Diperbarui tiap frame oleh
   *  sync loop, tiap goTo, dan tiap onload mount. */
  const lastTimeRef = useRef(0);
  const lastShotRef = useRef(-2);
  const lastCapRef = useRef(-2);
  const playingRef = useRef(false);
  const lenRef = useRef(30);
  const loopRef = useRef(true);
  const scrubRef = useRef<{ was: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timer debounce pratinjau langsung slider (tab Objek). */
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tourShownRef = useRef(false);
  const pendingMineRef = useRef<MyVideo | null>(null);
  const stateRef = useRef({ cur, fields, def, applied, base, shots, caps, len, muted, playing, draftCaps, draftShots, draftVO, voTouched, voKindState, origCaps, origShots, draftProps });
  stateRef.current = { cur, fields, def, applied, base, shots, caps, len, muted, playing, draftCaps, draftShots, draftVO, voTouched, voKindState, origCaps, origShots, draftProps };
  /** Cermin sinkron fullEdits (U5): saveCurrentFullEdit() harus menulis
   *  localStorage SECARA SINKRON dan tahu hasilnya, jadi ia menghitung
   *  `next` dari ref ini (bukan dari updater setState yang baru terlihat
   *  sesudah re-render) dan memperbarui ref di tempat yang sama. */
  const fullEditsRef = useRef(fullEdits);
  fullEditsRef.current = fullEdits;
  playingRef.current = playing;
  lenRef.current = len;
  loopRef.current = loopOn;

  const toast = useCallback((msg: string, isErr = false) => {
    setToastMsg(msg);
    setToastErr(isErr);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToastMsg(""); setToastErr(false); }, 2000);
  }, []);

  const st = useCallback(() => {
    const w = iframeRef.current?.contentWindow as unknown as
      | { __st?: { gT: () => number; seek: (t: number) => void; play: () => void; pause: () => void; len: () => number; caps: () => Cap[]; shots: () => Shot[]; mute: (m: boolean) => void; ok: () => boolean } }
      | null;
    return (w && w.__st) || null;
  }, []);

  /** Waktu video saat ini. Bila bridge belum siap (mis. iframe sedang
   *  live reload), kembalikan waktu terakhir yang tercatat, BUKAN 0 —
   *  0 membuat mount(keepTime=true) me-reset video ke awal (U6/F2). */
  const currentTime = useCallback(() => {
    const s = st();
    if (!s) return lastTimeRef.current;
    try {
      const t = s.gT();
      return Number.isFinite(t) ? t : lastTimeRef.current;
    } catch {
      return lastTimeRef.current;
    }
  }, [st]);

  const goTo = useCallback(
    (t: number) => {
      const s = st();
      if (!s || !ready) return;
      const tt = clamp(t, 0, Math.max(0, lenRef.current - 0.01));
      lastTimeRef.current = tt;
      seekGuardRef.current = true;
      s.seek(tt);
    },
    [st, ready]
  );

  const toggle = useCallback(() => {
    const s = st();
    if (!s || !ready) return;
    if (playingRef.current) {
      s.pause();
      setPlaying(false);
    } else {
      if (currentTime() >= lenRef.current - 0.05) {
        seekGuardRef.current = true;
        s.seek(0);
      }
      s.play();
      setPlaying(true);
    }
  }, [st, ready, currentTime]);

  /** Ketuk preview untuk memilih objek (tab Objek aktif): overlay .tap
   *  menutupi iframe sehingga klik tidak pernah sampai ke bridge di dalam
   *  template — koordinat dihitung di sini dari overlay itu sendiri.
   *  Klik tetap memutar/menjeda seperti biasa. */
  const handleTapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (tab === "objek") {
      const r = e.currentTarget.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const avail = new Set(propsAvail.map((p) => p.def.obj));
        const key = pickObjAt(cur.file, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, avail);
        if (key) { setSelObj(key); openSheetIfClosed("half"); }
      }
    }
    toggle();
  }, [tab, cur.file, propsAvail, toggle, openSheetIfClosed]);

  const normalize = useCallback((f: TextFields): TextFields => {
    const o = { ...f };
    (Object.keys(o) as (keyof TextFields)[]).forEach((k) => {
      const v = (o[k] || "").replace(/\r/g, "").trim();
      o[k] = v || def[k];
    });
    return o;
  }, [def]);

  const hasChanges = useCallback(() => {
    const n = normalize(fields);
    return (["title", "sub", "end"] as const).some((k) => n[k] !== def[k]);
  }, [normalize, fields, def]);

  const dirty = useMemo(() => {
    const n = normalize(fields);
    return (["title", "sub", "end"] as const).some((k) => n[k] !== applied[k]);
  }, [normalize, fields, applied]);

  const edited = useMemo(
    () => (["title", "sub", "end"] as const).some((k) => normalize(fields)[k] !== def[k]),
    [normalize, fields, def]
  );

  // ---------- theme ----------
  const setTheme = useCallback((t: "dark" | "light", silent = false) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("ss.theme", t);
    } catch { /* private mode */ }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0b0c0e" : "#f3f4f6");
    if (!silent) toast(t === "dark" ? "Tema gelap" : "Tema terang");
  }, [toast]);

  // ---------- viewer fit ----------
  const fitStage = useCallback(() => {
    const canvas = viewerCanvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return;
    const padPx = window.innerHeight <= 640 ? 8 : window.innerWidth <= 900 ? 8 : window.innerWidth <= 1180 ? 14 : 22;
    const availW = Math.max(60, r.width - padPx * 2);
    const availH = Math.max(80, r.height - padPx * 2);
    let h = Math.min(availH, (availW * 16) / 9);
    if (vZoom) h *= vZoom / 100;
    stage.style.height = Math.round(h) + "px";
    stage.style.width = Math.round((h * 9) / 16) + "px";
  }, [vZoom]);

  useEffect(() => {
    fitStage();
  }, [fitStage, drawerOpen, ready, focusView]);

  // Drawer: CSS memakai body.drawer-open / body.drawer-closed (port dari
  // studio.js vanilla). Tanpa ini, di layar <=1180px drawer tidak pernah
  // muncul karena .media tetap translateX(-100%), dan di layar lebar
  // menutup drawer tidak menyembunyikan panel. Sebelum fix ini, class
  // hanya dipasang di div.app yang tidak dipakai selector CSS mana pun.
  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    document.body.classList.toggle("drawer-closed", !drawerOpen);
    if (window.innerWidth > 1180) {
      try { localStorage.setItem("ss.drawer", drawerOpen ? "1" : "0"); } catch { /* private mode */ }
    }
    return () => {
      document.body.classList.remove("drawer-open", "drawer-closed");
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onResize = () => fitStage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitStage]);

  // ---------- bottom sheet: mode, snap, keyboard, timeline ----------
  // Mode sheet: portrait ≤900px (matchMedia + listener). Jangan baca
  // window di initializer state (hidrasi) — nilai awal false, efek ini
  // yang menyalakannya di klien.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
    const onChange = () => setSheetMode(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Masuk/keluar mode sheet: masuk selalu dari peek; keluar kembalikan
  // tinggi timeline + bersihkan transform inline, lalu fitStage().
  useEffect(() => {
    if (sheetMode) {
      setSheetSnap("peek");
      setTlManual(null);
      prevSnapRef.current = null;
    } else {
      if (prevTlHeightRef.current !== null) {
        setTlHeight(prevTlHeightRef.current);
        prevTlHeightRef.current = null;
      }
      setTlManual(null);
      kbOpenRef.current = false;
      setSheetKbOpen(false);
      const el = sheetRef.current;
      if (el) { el.style.transform = ""; el.style.transition = ""; }
      const t = setTimeout(() => fitStage(), 60);
      return () => clearTimeout(t);
    }
  }, [sheetMode, fitStage]);

  // Snap berubah: bersihkan transform inline (kelas CSS yang mengambil
  // alih), fitStage sesudah transisi .28s, toast lipatan sekali.
  useEffect(() => {
    const el = sheetRef.current;
    if (el) { el.style.transform = ""; el.style.transition = ""; }
    if (!sheetMode) return;
    if (sheetSnap !== "closed" && !tlToastShownRef.current) {
      tlToastShownRef.current = true;
      toast("Timeline dilipat — ketuk ▴ Timeline untuk memilih klip");
    }
    const t = setTimeout(() => fitStage(), 300);
    return () => clearTimeout(t);
  }, [sheetMode, sheetSnap, fitStage, toast]);

  // Timeline dilipat jadi strip saat sheet terbuka; dikembalikan utuh
  // saat sheet ditutup / lipatan dibuka manual. Nilai lama disimpan di
  // ref supaya tidak tertimpa (bukan "tinggi pilihan pengguna").
  useEffect(() => {
    if (!sheetMode) return;
    if (tlCollapsed) {
      if (prevTlHeightRef.current === null) prevTlHeightRef.current = tlHeight;
      const stripH = window.matchMedia("(pointer:coarse)").matches ? 72 : 60;
      if (tlHeight !== stripH) setTlHeight(stripH);
    } else if (prevTlHeightRef.current !== null) {
      setTlHeight(prevTlHeightRef.current);
      prevTlHeightRef.current = null;
    }
    const t = setTimeout(() => fitStage(), 300);
    return () => clearTimeout(t);
    // tlHeight sengaja tidak di-deps: efek ini yang menulisnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tlCollapsed, sheetMode, fitStage]);

  // Keyboard virtual: sumber kebenaran visualViewport (bukan
  // window.resize — di iOS keyboard tidak mengubah innerHeight).
  // Peek naik ke Half saat keyboard muncul; tinggi sheet di-clamp ke
  // --vv-h−76px lewat CSS; snap semula dikembalikan saat tutup.
  useEffect(() => {
    if (!sheetMode) return;
    const applyKb = (open: boolean, vvh: number) => {
      document.documentElement.style.setProperty("--vv-h", vvh + "px");
      if (open && !kbOpenRef.current) {
        kbOpenRef.current = true;
        setSheetKbOpen(true);
        if (sheetSnapRef.current === "peek") {
          prevSnapRef.current = "peek";
          setSheetSnap("half");
        }
      } else if (!open && kbOpenRef.current) {
        kbOpenRef.current = false;
        setSheetKbOpen(false);
        if (prevSnapRef.current) {
          setSheetSnap(prevSnapRef.current);
          prevSnapRef.current = null;
        }
      }
    };
    const vv = window.visualViewport;
    if (vv) {
      const onVv = () => applyKb(window.innerHeight - vv.height - vv.offsetTop > 120, vv.height);
      vv.addEventListener("resize", onVv);
      vv.addEventListener("scroll", onVv);
      onVv();
      return () => {
        vv.removeEventListener("resize", onVv);
        vv.removeEventListener("scroll", onVv);
        document.documentElement.style.removeProperty("--vv-h");
      };
    }
    const initH = window.innerHeight;
    const onResize = () => applyKb(window.innerHeight < initH - 120, window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.documentElement.style.removeProperty("--vv-h");
    };
  }, [sheetMode]);

  // Ketuk objek di preview: bridge di iframe mengirim {__stClick:{x,y}}.
  // Hanya aktif saat tab Objek terbuka; pilihannya tampil di header
  // "Sedang mengedit". Klik di preview tetap memutar/menjeda seperti biasa.
  useEffect(() => {
    if (tab !== "objek") return;
    const avail = new Set(propsAvail.map((p) => p.def.obj));
    const onMsg = (e: MessageEvent) => {
      const c = (e.data as { __stClick?: { x: number; y: number } } | null)?.__stClick;
      if (!c || typeof c.x !== "number" || typeof c.y !== "number") return;
      const key = pickObjAt(cur.file, c.x, c.y, avail);
      if (key) { setSelObj(key); openSheetIfClosed("half"); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [tab, cur.file, propsAvail, openSheetIfClosed]);

  // ---------- mount / load ----------
  const mount = useCallback(
    (keepTime: boolean, resumeAt = 0) => {
      const s = stateRef.current;
      if (!s.base) return;
      const id = loadIdRef.current;
      // Bridge hanya bisa dipercaya bila preview siap: bridge BARU yang
      // sedang dimuat sudah punya __st tapi gT()=0 sebelum onload men-seek.
      // Bila belum siap, pakai waktu terakhir yang tercatat (U6/F2).
      const t = keepTime ? (readyRef.current ? currentTime() : lastTimeRef.current) : resumeAt;
      const resume = keepTime && playingRef.current;
      const f = normalize(s.fields);
      const changed: Partial<TextFields> = {};
      (["title", "sub", "end"] as const).forEach((k) => {
        if (f[k] !== s.def[k]) changed[k] = f[k];
      });
      setApplied(f);
      const lite = window.matchMedia("(pointer:coarse)").matches;
      // Terapkan SEMUA edit ke string srcdoc (bukan hanya state React):
      // teks, lalu caps, shots, VO, dan props — via fungsi yang sama dengan
      // scripts/apply-edit.mjs, supaya hasil unduhan .html identik.
      let out = setText(s.base, changed);
      const capsChanged = s.origCaps !== null && JSON.stringify(s.draftCaps) !== JSON.stringify(s.origCaps);
      if (s.origCaps !== null && s.draftCaps.length) {
        const r = writeCaps(out, s.draftCaps);
        if (r.ok) out = r.html;
      }
      if (s.origShots !== null && s.draftShots.length) {
        const r = writeShots(out, s.draftShots);
        if (r.ok) out = r.html;
      }
      if (s.voTouched && s.draftVO) {
        const r = writeVO(out, s.draftVO);
        if (r.ok) out = r.html;
      } else if (capsChanged && s.voKindState === "literal") {
        // VO mengikuti teks caption baru (peringatan tampil di tab Caption).
        const r = writeVO(out, s.draftCaps.map((c) => c[2]));
        if (r.ok) out = r.html;
      }
      if (Object.keys(s.draftProps).length) {
        const r = writeProps(out, s.cur.file, s.draftProps);
        if (r.ok) out = r.html;
      }
      out = out
        .replace("</body>", BRIDGE + "</body>")
        .replace(
          "<head>",
          lite
            ? '<head><script>try{Object.defineProperty(window,"devicePixelRatio",{get:function(){return 1}})}catch(e){}</script>'
            : "<head>"
        );
      // Preview pakai three.js lokal dari /vendor/ (bukan CDN) — lihat
      // lib/studio.ts "VENDOR three.js". Satu-satunya tempat rewrite:
      // mount() dilewati SEMUA jalur preview (template asli, edit
      // tersimpan, Video Buatan Saya). Export .html TIDAK lewat sini
      // (tetap CDN, standalone — via applyEdits/downloadMine).
      const rewritten = rewriteThreeCdnToLocal(out);
      if (rewritten.replaced > 0) out = rewritten.html;
      const pv = iframeRef.current;
      if (!pv) return;
      // Live reload: preview BELUM siap sampai onload sukses — tandai
      // ready=false supaya Terapkan/Kembalikan (dan goTo/toggle) tidak
      // bisa jalan saat bridge hilang (akar U6/F2: ready tetap true).
      readyRef.current = false;
      setReady(false);
      pv.onload = () => {
        if (id !== loadIdRef.current) return;
        const w = pv.contentWindow as unknown as {
          __st?: {
            ok: () => boolean;
            len: () => number;
            shots: () => Shot[];
            caps: () => Cap[];
            mute: (m: boolean) => void;
            pause: () => void;
            seek: (t: number) => void;
            play: () => void;
          };
          __stErr?: string;
        } | null;
        const bridge = w?.__st;
        if (!bridge || !bridge.ok()) {
          const why = !bridge
            ? ((w && (w as { __stErr?: string }).__stErr) || "bridge tidak terpasang")
            : "three.js belum termuat — file vendor (/vendor/three.min.js) tidak ditemukan.";
          setSkelText("Preview tidak bisa dimulai");
          setSkelWhy(why);
          setStatus("err");
          setStatusText("Preview error");
          setStatusInfo("Preview belum bisa dimulai · cek koneksi lalu Coba lagi");
          readyRef.current = false;
          setReady(false);
          toast("Preview gagal dimulai");
          return;
        }
        const L = bridge.len() || 30;
        const SH = bridge.shots() || [];
        const CP = bridge.caps() || [];
        setLen(L);
        lenRef.current = L;
        setShots(SH);
        setCaps(CP);
        try {
          bridge.mute(stateRef.current.muted);
        } catch { /* template lama */ }
        bridge.pause();
        bridge.seek(t);
        lastTimeRef.current = t;
        setStatus("ok");
        setStatusText("Preview siap");
        setStatusInfo(`${TEMPLATES.length} template · ${fmt(L)} · ${SH.length} shot · ${CP.length} caption`);
        readyRef.current = true;
        setReady(true);
        lastTRef.current = -1;
        lastShotRef.current = lastCapRef.current = -2;
        setPlaying(false);
        if (resume) {
          bridge.play();
          setPlaying(true);
        }
        setTime(t);
        requestAnimationFrame(() => fitStage());
        if (!tourShownRef.current) {
          try {
            if (!localStorage.getItem("ss.tour")) {
              tourShownRef.current = true;
              setTimeout(() => setTourStep(0), 750);
            }
          } catch { /* ignore */ }
        }
      };
      pv.srcdoc = out;
    },
    [currentTime, fitStage, normalize, toast]
  );

  const load = useCallback(
    async (t: TemplateEntry) => {
      const id = ++loadIdRef.current;
      cancelAnimationFrame(rafRef.current);
      setBase("");
      readyRef.current = false;
      setReady(false);
      setPlaying(false);
      setStatus("load");
      setStatusText("Memuat…");
      setSkelText("Menyiapkan preview…");
      setSkelWhy("");
      setStatusInfo("Memuat " + t.label + "…");
      setShots([]);
      setCaps([]);
      setSel(null);
      setTab("teks");
      let html: string;
      try {
        const r = await fetch("/templates/" + t.file);
        if (!r.ok) throw new Error("HTTP " + r.status);
        html = await r.text();
      } catch (e) {
        if (id !== loadIdRef.current) return;
        setSkelText("Gagal memuat " + t.file);
        setSkelWhy(String((e as Error).message || e));
        setStatus("err");
        setStatusText("Preview error");
        setStatusInfo("Preview belum bisa dimulai · cek koneksi lalu Coba lagi");
        toast("Gagal memuat template");
        return;
      }
      if (id !== loadIdRef.current) return;
      const d = parseDefaults(html, t);
      setDef(d);
      // Edit tersimpan: entri "Video Buatan Saya" yang sedang dibuka menang
      // atas edit per-template, yang menang atas teks asli.
      const mineOverride = pendingMineRef.current && pendingMineRef.current.file === t.file ? pendingMineRef.current : null;
      pendingMineRef.current = null;
      setActiveMineId(mineOverride ? mineOverride.id : null);
      const fe = fullEdits[t.file];
      const saved = edits[t.file];
      const f = mineOverride
        ? { title: mineOverride.title, sub: mineOverride.sub, end: mineOverride.end }
        : fe?.text || saved || d;
      setFields(f);
      setApplied(mineOverride || fe?.text || saved ? normalize(f) : { ...d });
      // Caps / shots / VO / props asli dari HTML template.
      const pc = parseCaps(html);
      const ps = parseShots(html);
      const pv = parseVO(html);
      const vk = voKind(html);
      const pp = parseProps(html, t.file);
      setOrigCaps(pc);
      setOrigShots(ps);
      setOrigVO(pv);
      setVoKindState(vk);
      setHasSpeaker(!!pc && pc.some((c) => c.length === 4));
      setPropsAvail(pp.filter((p) => p.available && p.value !== undefined).map((p) => ({ def: p.def, value: p.value as PropValue })));
      const origP: PropValues = {};
      pp.forEach((p) => {
        if (p.available && p.value !== undefined) origP[p.def.id] = p.value;
      });
      setOrigProps(origP);
      setDraftCaps(mineOverride?.caps ?? fe?.caps ?? pc ?? []);
      setDraftShots(mineOverride?.shots ?? fe?.shots ?? ps ?? []);
      setDraftVO(mineOverride?.vo ?? fe?.vo ?? pv ?? null);
      // Edit tersimpan / Video Buatan Saya sudah diterapkan ke preview
      // saat load (via mount), jadi baseline "diterapkan" = draft awal.
      setAppliedCaps(mineOverride?.caps ?? fe?.caps ?? pc ?? []);
      setAppliedShots(mineOverride?.shots ?? fe?.shots ?? ps ?? []);
      setAppliedVO(mineOverride?.vo ?? fe?.vo ?? pv ?? null);
      setVoTouched(!!(mineOverride?.vo || fe?.voTouched));
      const dp = mineOverride?.props ?? fe?.props ?? origP;
      setDraftProps(dp);
      setAppliedProps(dp);
      // Teks mentah field JSON prop array dari nilai yang sama (bukan dari
      // origP saja — edit tersimpan / Video Buatan Saya bisa membawa nilai
      // array yang sudah diubah).
      const at: Record<string, string> = {};
      pp.forEach((p) => {
        if (p.def.kind === "array" && p.available) {
          const v = (dp as PropValues)[p.def.id] ?? p.value;
          if (v !== undefined) at[p.def.id] = JSON.stringify(v);
        }
      });
      setArrayText(at);
      setArrayErr({});
      setBase(html);
    },
    [edits, fullEdits, normalize, toast]
  );

  // mount setiap kali base berubah (template selesai dimuat)
  const baseRef = useRef("");
  useEffect(() => {
    if (base && base !== baseRef.current) {
      baseRef.current = base;
      mount(false, 0);
    }
    if (!base) baseRef.current = "";
  }, [base, mount]);

  /** Simpan edit saat ini (teks+caps+shots+vo+props) ke ss.edits.v1.
   *  Kembalikan TRUE bila tulis berhasil (atau tidak ada yang perlu
   *  disimpan), FALSE bila tulis localStorage gagal (U5). Tulis dilakukan
   *  SINKRON di sini — bukan menunggu efek persist di bawah — supaya
   *  pemanggil (Terapkan, Kembalikan, ganti template) bisa memberi toast
   *  yang jujur: sukses hanya bila benar-benar tersimpan. Efek persist
   *  tetap ada sebagai jaring pengaman dan menulis ulang nilai yang sama. */
  const saveCurrentFullEdit = useCallback((): boolean => {
    const s = stateRef.current;
    if (!s.base || !s.cur) return true;
    const fe: FullEdit = {};
    const n = normalize(s.fields);
    if ((["title", "sub", "end"] as const).some((k) => n[k] !== s.def[k])) fe.text = { ...n };
    if (s.origCaps !== null && JSON.stringify(s.draftCaps) !== JSON.stringify(s.origCaps)) fe.caps = s.draftCaps.map((c) => [...c] as Cap);
    if (s.origShots !== null && JSON.stringify(s.draftShots) !== JSON.stringify(s.origShots))
      fe.shots = s.draftShots.map((x) => [x[0], [...x[1]], [...x[2]]] as Shot);
    if (s.voTouched && s.draftVO) fe.vo = [...s.draftVO];
    if (s.voTouched) fe.voTouched = true;
    if (JSON.stringify(s.draftProps) !== JSON.stringify(origProps)) fe.props = { ...s.draftProps };
    const next = { ...fullEditsRef.current };
    if (Object.keys(fe).length) next[s.cur.file] = fe;
    else delete next[s.cur.file];
    const ok = writeLS(EDITS_KEY, JSON.stringify(next));
    fullEditsRef.current = next;
    setFullEdits(next);
    return ok;
  }, [normalize, origProps]);

  const openTemplate = useCallback(
    (t: TemplateEntry, opts?: { push?: boolean }) => {
      if (cur === t && base) return;
      if (cur && base) {
        setEdits((prev) => {
          const next = { ...prev };
          if (hasChanges()) next[cur.file] = { ...normalize(fields) };
          else delete next[cur.file];
          return next;
        });
        // Draf template lama di-persist saat pindah (H4/A13): bila tulis
        // gagal, beri tahu — draf itu hilang saat reload (U5).
        if (!saveCurrentFullEdit()) toast(ERR_DRAFT, true);
      }
      // Buka biasa (bukan via Video Buatan Saya) = lepas dari entri mine.
      if (!pendingMineRef.current) setActiveMineId(null);
      setCur(t);
      try {
        localStorage.setItem("ss.last", slug(t));
        // U11: ganti template in-app (drawer/palet/Video Buatan Saya)
        // menambah entri riwayat (pushState) supaya Back browser kembali
        // ke template sebelumnya, bukan keluar ke about:blank.
        // pushState TIDAK memicu hashchange — tidak ada loop dengan
        // listener hashchange di bawah. Pergantian lewat hashchange
        // (Back/Forward/ketik manual) memakai replaceState: entrinya
        // sudah ada, jangan digandakan.
        if (opts?.push) history.pushState(null, "", "#" + slug(t));
        else history.replaceState(null, "", "#" + slug(t));
      } catch { /* file:// */ }
      document.title = t.label + " · Short Studio";
      load(t);
    },
    [cur, base, hasChanges, normalize, fields, load, saveCurrentFullEdit, toast]
  );

  /** Cermin sinkron openTemplate (U11): listener hashchange harus selalu
   *  memanggil versi terbaru (cur/base terbaru) tanpa daftar ulang. */
  const openTemplateRef = useRef(openTemplate);
  openTemplateRef.current = openTemplate;

  // Restore simpanan (mount saja, sesudah hidrasi): baca ss.edits.v1 +
  // ss.mine.v1 dari localStorage, lalu tandai restored agar init di bawah
  // jalan dengan fullEdits yang sudah dipulihkan. Tanpa gate restored,
  // load() pertama akan memakai fullEdits={} dan edit tersimpan tidak
  // diterapkan ke template pertama.
  useEffect(() => {
    try {
      const fe = JSON.parse(localStorage.getItem(EDITS_KEY) || "{}");
      if (fe && typeof fe === "object") setFullEdits(fe);
    } catch { /* simpanan rusak -> pakai {} */ }
    try {
      const mn = JSON.parse(localStorage.getItem(MINE_KEY) || "[]");
      if (Array.isArray(mn)) setMine(mn);
    } catch { /* simpanan rusak -> pakai [] */ }
    setRestored(true);
  }, []);

  // init sekali: hash / last template, tema, zoom — jalan sesudah restore
  // (lihat atas) supaya load(first) melihat edit tersimpan.
  useEffect(() => {
    if (!restored) return;
    try {
      const savedTheme = localStorage.getItem("ss.theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme, true);
    } catch { /* ignore */ }
    const rawHash = (() => { try { return decodeURIComponent(window.location.hash.slice(1)); } catch { return ""; } })();
    const want = rawHash || (() => { try { return localStorage.getItem("ss.last") || ""; } catch { return ""; } })();
    const found = TEMPLATES.find((t) => slug(t) === want);
    const first = found || TEMPLATES[0];
    // U11: hash tidak dikenal (mis. tautan salah ketik) jangan ditelan
    // diam-diam — beri tahu pengguna + perbaiki hash ke template yang
    // dibuka. Hash kosong / ss.last usang tetap fallback diam-diam
    // (bukan ketikan pengguna, tidak ada yang perlu dijelaskan).
    if (rawHash && !found) {
      toast("Template itu tidak ditemukan, dibuka template pertama");
      try { history.replaceState(null, "", "#" + slug(first)); } catch { /* file:// */ }
    }
    const narrow = window.innerWidth <= 1180;
    setDrawerOpen(!narrow && (() => { try { return localStorage.getItem("ss.drawer") !== "0"; } catch { return true; } })());
    try {
      const vz = +(localStorage.getItem("ss.vzoom") || 0);
      if ([0, 75, 50].includes(vz)) setVZoom(vz);
    } catch { /* ignore */ }
    document.title = first.label + " · Short Studio";
    setCur(first);
    load(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  // U11 — ikuti perubahan hash (ketik manual di address bar, tombol
  // Back/Forward browser). pushState di openTemplate TIDAK memicu
  // hashchange, begitu pula replaceState — handler ini tidak pernah
  // memicu dirinya sendiri (tidak ada loop). Satu hashchange = satu
  // pergantian: openTemplate no-op bila template yang dituju sudah
  // terbuka, dan draf kotor tetap disimpan dulu seperti pindah biasa.
  useEffect(() => {
    if (!restored) return;
    const onHash = () => {
      const want = (() => { try { return decodeURIComponent(window.location.hash.slice(1)); } catch { return ""; } })();
      if (!want) return; // hash dikosongkan: biarkan template sekarang
      const t = TEMPLATES.find((x) => slug(x) === want);
      if (!t) {
        toast("Template itu tidak ditemukan, dibuka template pertama");
        try { history.replaceState(null, "", "#" + slug(TEMPLATES[0])); } catch { /* file:// */ }
        openTemplateRef.current(TEMPLATES[0]);
        return;
      }
      openTemplateRef.current(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [restored, toast]);

  // Persistensi edit per-template (ss.edits.v1). Gate restored: tanpa ini
  // efek mount pertama akan menimpa simpanan lama dengan {} (nilai awal
  // kosong pasca-perbaikan hidrasi) sebelum restore sempat membacanya.
  // Jaring pengaman saja: saveCurrentFullEdit() sudah menulis nilai yang
  // sama secara sinkron + melaporkan gagal ke pemanggil (U5), jadi efek
  // ini SENGAJA diam bila gagal — toast ganda untuk satu kegagalan sama
  // hanya akan menakut-nakuti pengguna dua kali.
  useEffect(() => {
    if (!restored) return;
    writeLS(EDITS_KEY, JSON.stringify(fullEdits));
  }, [fullEdits, restored]);

  // ---------- validasi draft (error = blokir Terapkan, warning = kuning) ----------
  const capsChanged = useMemo(
    () => origCaps !== null && JSON.stringify(draftCaps) !== JSON.stringify(origCaps),
    [draftCaps, origCaps]
  );
  const shotsChanged = useMemo(
    () => origShots !== null && JSON.stringify(draftShots) !== JSON.stringify(origShots),
    [draftShots, origShots]
  );
  const propsChanged = useMemo(
    () => JSON.stringify(draftProps) !== JSON.stringify(origProps),
    [draftProps, origProps]
  );
  /** Perubahan yang BELUM diterapkan (draft vs baseline terakhir
   *  diterapkan) — inilah yang menggerakkan tombol Terapkan, baris
   *  status, dan catatan VO. `*Changed` di atas (vs orig) tetap dipakai
   *  persistensi, ekspor, Video Buatan Saya, dan tombol "Kembalikan". */
  const capsPending = useMemo(
    () => appliedCaps !== null && JSON.stringify(draftCaps) !== JSON.stringify(appliedCaps),
    [draftCaps, appliedCaps]
  );
  const shotsPending = useMemo(
    () => appliedShots !== null && JSON.stringify(draftShots) !== JSON.stringify(appliedShots),
    [draftShots, appliedShots]
  );
  const propsPending = useMemo(
    () => JSON.stringify(draftProps) !== JSON.stringify(appliedProps),
    [draftProps, appliedProps]
  );
  const voPending = useMemo(
    () => voTouched && JSON.stringify(draftVO) !== JSON.stringify(appliedVO),
    [voTouched, draftVO, appliedVO]
  );
  const capVal = useMemo(
    () => (origCaps !== null ? validateCaps(draftCaps, len) : { errors: [] as string[], warnings: [] as string[] }),
    [draftCaps, origCaps, len]
  );
  const shotVal = useMemo(
    () => (origShots !== null ? validateShots(draftShots, len) : { errors: [] as string[], warnings: [] as string[] }),
    [draftShots, origShots, len]
  );
  const propVal = useMemo(() => {
    const v = validateProps(draftProps, cur.file, len);
    // Cek silang WIN/TL + meeting.end (cermin crossCheckFinal di .mjs):
    // validateProps() sendiri tidak melakukannya, seperti di .mjs.
    const cc = crossCheckProps(draftProps, len);
    return { errors: [...v.errors, ...cc.errors], warnings: [...v.warnings, ...cc.warnings] };
  }, [draftProps, cur.file, len]);
  const allErrors = useMemo(
    () => [...capVal.errors, ...shotVal.errors, ...propVal.errors, ...Object.values(arrayErr)],
    [capVal, shotVal, propVal, arrayErr]
  );
  // Error per baris — dipakai penanda inline di dekat field yang salah
  // (temuan audit: pesan di bawah daftar tidak terlihat saat mengedit).
  // Format pesan selalu "Caption #N: …" / "Shot #N: …" / "<id prop>: …".
  const capErrByRow = useMemo(() => {
    const m: Record<number, string[]> = {};
    capVal.errors.forEach((e) => {
      const mt = /^Caption #(\d+):/.exec(e);
      if (mt) (m[+mt[1] - 1] ??= []).push(e);
    });
    return m;
  }, [capVal]);
  const shotErrByRow = useMemo(() => {
    const m: Record<number, string[]> = {};
    shotVal.errors.forEach((e) => {
      const mt = /^Shot #(\d+):/.exec(e);
      if (mt) (m[+mt[1] - 1] ??= []).push(e);
    });
    return m;
  }, [shotVal]);
  const propErrById = useMemo(() => {
    const m: Record<string, string[]> = {};
    propVal.errors.forEach((e) => {
      // Bentuk gabungan "claude.x dan claude.sway: ..." ditempel ke kedua baris.
      const mt = /^([\w.]+)(?: dan ([\w.]+))?:/.exec(e);
      if (mt) for (const id of [mt[1], mt[2]]) {
        if (id && propsAvail.some((p) => p.def.id === id)) (m[id] ??= []).push(e);
      }
    });
    return m;
  }, [propVal, propsAvail]);
  /** Daftar objek di template ini (tab Objek): nama awam + ikon + warna
   *  dari OBJECTS, hanya yang punya minimal satu pengaturan. */
  const objList = useMemo(() => {
    const byObj = new Map<string, PropDef[]>();
    propsAvail.forEach((p) => {
      const arr = byObj.get(p.def.obj) || [];
      arr.push(p.def);
      byObj.set(p.def.obj, arr);
    });
    return Object.keys(OBJECTS)
      .filter((k) => byObj.has(k))
      .map((k) => {
        const defs = byObj.get(k)!;
        const changed = defs.some((d) => JSON.stringify(draftProps[d.id]) !== JSON.stringify(origProps[d.id]));
        return { key: k, ...OBJECTS[k], count: defs.length, changed, defs };
      });
  }, [propsAvail, draftProps, origProps]);
  /** Objek aktif: pilihan user, atau objek pertama bila pilihannya tidak
   *  ada di template ini (mis. habis ganti template). */
  const activeObjKey = selObj && objList.some((o) => o.key === selObj) ? selObj : objList[0]?.key ?? null;
  const activeObj = objList.find((o) => o.key === activeObjKey) ?? null;
  const allWarnings = useMemo(() => [...capVal.warnings, ...shotVal.warnings, ...propVal.warnings], [capVal, shotVal, propVal]);
  const voFollowNote = useMemo(() => {
    if (!capsPending || voTouched) return "";
    if (voKindState === "literal") return "Suara akan mengikuti teks caption baru saat diterapkan.";
    if (voKindState === "derived") return "Suara di video ini mengikuti caption otomatis.";
    return "";
  }, [capsPending, voTouched, voKindState]);
  const anyDirty = useMemo(
    () => dirty || capsPending || shotsPending || propsPending || voPending,
    [dirty, capsPending, shotsPending, propsPending, voPending]
  );

  /** Kelompok perubahan untuk baris status tombol Terapkan: tombol itu
   *  sengaja disabled bila tidak ada edit (by-design, bukan bug) — tapi
   *  tanpa penjelasan tampak rusak, jadi keadaannya ditulis eksplisit
   *  di bawah tombol di semua tab. */
  const changeGroups = useMemo(() => {
    const g: string[] = [];
    const n = normalize(fields);
    // Teks dibandingkan ke `applied` (sudah diterapkan), bukan `def`:
    // teks yang sudah diterapkan tidak boleh tampil sebagai "siap
    // diterapkan" saat kelompok lain masih pending.
    const tc = (["title", "sub", "end"] as const).filter((k) => n[k] !== applied[k]).length;
    if (tc) g.push(`${tc} teks`);
    if (capsPending) g.push("caption");
    if (shotsPending) g.push("shot");
    if (propsPending) g.push("pengaturan objek");
    if (voPending) g.push("suara");
    return g;
  }, [normalize, fields, applied, capsPending, shotsPending, propsPending, voPending]);
  const applyStateText = useMemo(() => {
    if (!ready) return "Menunggu preview siap…";
    if (allErrors.length) return `Ada ${allErrors.length} error validasi — perbaiki dulu, Terapkan ditahan.`;
    if (!anyDirty) return "Tidak ada perubahan — ubah teks, caption, shot, atau pengaturan objek untuk mengaktifkan Terapkan.";
    return `Siap diterapkan: ${changeGroups.join(" · ")}.`;
  }, [ready, allErrors.length, anyDirty, changeGroups]);


  /** Terapkan SEMUA edit (teks+caps+shots+VO+props) — tombol Terapkan di
   *  semua tab dan Ctrl+Enter. Diblokir bila ada error validasi.
   *  Bila tulis penyimpanan GAGAL (U5): pratinjau tetap diperbarui
   *  (mount), tapi baseline "diterapkan" SENGAJA tidak diubah — Terapkan
   *  tetap aktif + status tetap "Siap diterapkan", supaya pengguna bisa
   *  mencoba lagi sesudah mengosongkan penyimpanan. Toast sukses TIDAK
   *  ditampilkan; yang tampil toast error awam. */
  const applyAll = useCallback(() => {
    if (!base || !ready || !anyDirty || allErrors.length) return;
    if (!saveCurrentFullEdit()) {
      // mount() ikut memanggil setApplied(fields) — kembalikan baseline
      // "diterapkan" ke nilai lama supaya Terapkan tetap aktif + status
      // tetap "Siap diterapkan": pengguna bisa mencoba lagi sesudah
      // mengosongkan penyimpanan, tanpa harus mengedit ulang.
      const prevApplied = stateRef.current.applied;
      mount(true);
      setApplied(prevApplied);
      toast(ERR_EDIT, true);
      return;
    }
    // Jadikan draft yang baru diterapkan sebagai baseline "diterapkan",
    // supaya tombol kembali disabled + status "Tidak ada perubahan".
    // orig* SENGAJA tidak diubah (lihat komentar di deklarasi
    // appliedCaps): saveCurrentFullEdit() di atas sudah menyimpan edit
    // vs orig* sebelum baseline ini diperbarui. Nilai diambil dari
    // stateRef (selalu segar; closure applyAll tidak membawa draft* di
    // deps) dan di-deep-copy supaya edit berikutnya tidak mengotori
    // baseline lewat referensi bersama.
    const s = stateRef.current;
    setAppliedCaps(s.draftCaps.map((c) => [...c] as Cap));
    setAppliedShots(s.draftShots.map((x) => [x[0], [...x[1]], [...x[2]]] as Shot));
    setAppliedVO(s.draftVO ? [...s.draftVO] : null);
    setAppliedProps(JSON.parse(JSON.stringify(s.draftProps)) as PropValues);
    setEdits((prev) => {
      const next = { ...prev };
      if (hasChanges()) next[cur.file] = { ...normalize(fields) };
      else delete next[cur.file];
      return next;
    });
    mount(true);
    toast("Semua edit diterapkan");
  }, [base, ready, anyDirty, allErrors.length, saveCurrentFullEdit, hasChanges, cur, normalize, fields, mount, toast]);

  /** Pratinjau langsung saat slider/warna digeser: muat ulang preview
   *  (debounce ~250 mdtk) tanpa mengubah baseline "diterapkan" dan tanpa
   *  menyimpan. Hanya jalan saat tab Objek aktif dan nilai barunya lolos
   *  validasi — nilai yang ditolak tidak memicu pratinjau (slider
   *  kembali ke nilai lama + error tampil di barisnya). */
  const scheduleLive = useCallback((candidate: PropValues) => {
    if (tab !== "objek") return;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => {
      const v = validateProps(candidate, cur.file, len);
      const cc = crossCheckProps(candidate, len);
      if (!v.errors.length && !cc.errors.length) mount(true);
    }, 250);
  }, [tab, cur.file, len, mount]);

  /** Ubah satu nilai pengaturan (angka/warna/teks) + pratinjau langsung
   *  bila jenisnya angka/warna. Teks tidak memicu pratinjau tiap ketik —
   *  ia diterapkan lewat tombol Terapkan. */
  const setPropValue = useCallback((def: PropDef, v: PropValue) => {
    const candidate = { ...stateRef.current.draftProps, [def.id]: v };
    setDraftProps(candidate);
    if (def.kind === "number" || def.kind === "color") scheduleLive(candidate);
  }, [scheduleLive]);

  // Pola yang sama di keempat reset (U2): nilai reset ditulis dulu ke
  // stateRef secara sinkron — saveCurrentFullEdit() membaca stateRef,
  // sedangkan setState React baru terlihat sesudah re-render, jadi
  // pemanggilan langsung tanpa ini akan menyimpan nilai LAMA. Sesudah
  // itu saveCurrentFullEdit() menghapus entri template ini dari
  // ss.edits.v1 (draft == asli -> fe kosong), jadi reset bertahan
  // sesudah reload. Baseline "diterapkan" ikut disamakan ke asli supaya
  // Terapkan kembali disabled + status "Tidak ada perubahan" di sesi itu
  // (sebelumnya reset caption/shot/objek membiarkan Terapkan aktif — C4).
  const resetText = useCallback(() => {
    setFields(def);
    setApplied(def);
    stateRef.current.fields = def;
    setEdits((prev) => {
      const next = { ...prev };
      delete next[cur.file];
      return next;
    });
    const ok = saveCurrentFullEdit();
    if (base) {
      // mount memakai fields dari stateRef — tunda satu tick agar fields baru kebaca
      setTimeout(() => mount(true), 0);
    }
    // U5: bila tulis gagal, jangan klaim "dikembalikan" — reset tidak akan
    // bertahan sesudah reload (edit lama kembali).
    toast(ok ? "Teks dikembalikan ke asli" : ERR_RESET, !ok);
  }, [def, cur, base, mount, toast, saveCurrentFullEdit]);

  const resetCaps = useCallback(() => {
    if (!origCaps) return;
    const caps = origCaps.map((c) => [...c] as Cap);
    const vo = origVO ? [...origVO] : null;
    setDraftCaps(caps);
    setDraftVO(vo);
    setVoTouched(false);
    setAppliedCaps(caps.map((c) => [...c] as Cap));
    setAppliedVO(vo ? [...vo] : null);
    stateRef.current.draftCaps = caps;
    stateRef.current.draftVO = vo;
    stateRef.current.voTouched = false;
    const ok = saveCurrentFullEdit();
    setTimeout(() => mount(true), 0);
    toast(ok ? "Caption dikembalikan ke asli" : ERR_RESET, !ok);
  }, [origCaps, origVO, mount, toast, saveCurrentFullEdit]);

  const resetShots = useCallback(() => {
    if (!origShots) return;
    const shots = origShots.map((x) => [x[0], [...x[1]], [...x[2]]] as Shot);
    setDraftShots(shots);
    setAppliedShots(shots.map((x) => [x[0], [...x[1]], [...x[2]]] as Shot));
    stateRef.current.draftShots = shots;
    const ok = saveCurrentFullEdit();
    setTimeout(() => mount(true), 0);
    toast(ok ? "Shot dikembalikan ke asli" : ERR_RESET, !ok);
  }, [origShots, mount, toast, saveCurrentFullEdit]);

  const resetProps = useCallback(() => {
    const dp = { ...origProps };
    setDraftProps(dp);
    setAppliedProps({ ...dp });
    const at: Record<string, string> = {};
    propsAvail.forEach(({ def }) => {
      if (def.kind === "array" && origProps[def.id] !== undefined) at[def.id] = JSON.stringify(origProps[def.id]);
    });
    setArrayText(at);
    setArrayErr({});
    stateRef.current.draftProps = dp;
    const ok = saveCurrentFullEdit();
    setTimeout(() => mount(true), 0);
    toast(ok ? "Pengaturan objek dikembalikan ke asli" : ERR_RESET, !ok);
  }, [origProps, mount, toast, propsAvail, saveCurrentFullEdit]);

  /** Terapkan nilai baru untuk satu prop array (sudah ter-parse).
   *  Nilai yang lolos validasi (validator per-def + cek silang WIN/TL /
   *  meeting.end) masuk draftProps; yang tidak lolos hanya menampilkan
   *  error dan menahan Terapkan (arrayErr masuk allErrors) — draftProps
   *  tidak diubah. Dipakai kontrol slider/daftar maupun field teks.
   *  `live=true` (slider/daftar saja, bukan field teks) juga memicu
   *  pratinjau langsung seperti slider angka biasa — debounce yang sama
   *  di scheduleLive, dan nilai yang ditolak validasi tidak memicu
   *  pratinjau karena draftProps tidak berubah. */
  const applyArrayValue = useCallback((def: PropDef, parsed: unknown, live = false) => {
    const candidate = { ...draftProps, [def.id]: parsed as PropValue };
    const v = validateProps(candidate, cur.file, len);
    const cc = crossCheckProps(candidate, len);
    const mine = [...v.errors, ...cc.errors].filter(
      (err) =>
        err.includes(def.id) ||
        (def.id.startsWith("typing.") && err.startsWith("typing")) ||
        (def.id === "meeting.end" && err.startsWith("meeting.end"))
    );
    if (mine.length) {
      setArrayErr((prev) => ({ ...prev, [def.id]: mine.map(stripPropId).join(" ") }));
      return false;
    }
    setArrayErr((prev) => {
      const next = { ...prev };
      delete next[def.id];
      return next;
    });
    setDraftProps(candidate);
    if (live) scheduleLive(candidate);
    return true;
  }, [draftProps, cur.file, len, scheduleLive]);

  /** Ubah satu prop array lewat field teks. Nilai yang lolos parse +
   *  validasi masuk draftProps; yang tidak lolos hanya menampilkan error
   *  dan menahan Terapkan — draftProps tidak diubah. */
  const handleArrayPropChange = useCallback((def: PropDef, text: string) => {
    setArrayText((prev) => ({ ...prev, [def.id]: text }));
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setArrayErr((prev) => ({ ...prev, [def.id]: `Tulisannya tidak bisa dibaca: ${String((e as Error).message || e)}` }));
      return;
    }
    applyArrayValue(def, parsed);
  }, [applyArrayValue]);

  /** Spec kanonik edit saat ini (untuk dialog Ekspor + unduh .html). */
  const buildSpec = useCallback((): EditSpec => {
    const spec: EditSpec = { file: cur.file };
    const n = normalize(fields);
    (["title", "sub", "end"] as const).forEach((k) => {
      if (n[k] !== def[k]) spec[k] = n[k];
    });
    if (capsChanged) spec.caps = draftCaps;
    if (shotsChanged) spec.shots = draftShots;
    if (voTouched && draftVO) spec.vo = draftVO;
    const changedProps: PropValues = {};
    Object.keys(draftProps).forEach((id) => {
      if (JSON.stringify(draftProps[id]) !== JSON.stringify(origProps[id])) changedProps[id] = draftProps[id];
    });
    if (Object.keys(changedProps).length) spec.props = changedProps;
    return spec;
  }, [cur, normalize, fields, def, capsChanged, draftCaps, shotsChanged, draftShots, voTouched, draftVO, draftProps, origProps]);

  const specJson = useMemo(() => JSON.stringify(buildSpec(), null, 2), [buildSpec]);
  const hasNonTextEdits = useMemo(
    () => capsChanged || shotsChanged || propsChanged || (voTouched && draftVO !== null),
    [capsChanged, shotsChanged, propsChanged, voTouched, draftVO]
  );

  // Entri "Video Buatan Saya" yang sedang dibuka (U4): bila ada, dialog
  // simpan beralih ke mode "Perbarui video ini" dan confirmSaveMine
  // memperbarui entri itu, bukan membuat duplikat.
  const activeMineEntry = activeMineId ? mine.find((m) => m.id === activeMineId) ?? null : null;

  // ---------- Video Buatan Saya ----------
  // U4: simpan-ulang MEMPERBARUI entri yang sedang dibuka (activeMineId),
  // bukan membuat duplikat. Keputusan UX (lihat verification/fix-audit500-g4-u4.md):
  // - Buka entri tersimpan -> edit -> Simpan = perbarui entri itu (id tetap,
  //   isi ikut yang terbaru, posisi di daftar tetap, createdAt tetap,
  //   updatedAt dicatat). Label ikut NAMA ENTRI LAMA (prefill dialog), bukan
  //   judul yang sedang diedit — supaya simpan-ulang tidak diam-diam
  //   mengganti nama; rename hanya bila pengguna mengubah kolom nama.
  //   Toast menyebut "diperbarui", bukan "disimpan".
  // - Buka TEMPLATE asli -> Simpan = tetap buat entri baru (activeMineId null).
  // - Simpan tanpa edit dari entri tersimpan = tetap perbarui (tanpa duplikat);
  //   tidak ada yang berubah selain updatedAt — aman dan konsisten.
  // - Ganti nama label di dialog = perbarui entri yang sama dengan label baru.
  const confirmSaveMine = useCallback(() => {
    const label = saveMineLabel.trim() || fields.title.trim() || cur.label;
    const n = normalize(fields);
    const existing = activeMineId ? mine.find((m) => m.id === activeMineId) : undefined;
    const entry: MyVideo = {
      id: existing ? existing.id : "mine-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label,
      file: cur.file,
      title: n.title,
      sub: n.sub,
      end: n.end,
      createdAt: existing ? existing.createdAt : Date.now(),
    };
    if (existing) entry.updatedAt = Date.now();
    if (capsChanged) entry.caps = draftCaps;
    if (shotsChanged) entry.shots = draftShots;
    if (voTouched && draftVO) entry.vo = draftVO;
    if (propsChanged) entry.props = { ...draftProps };
    // U5: tulis ke localStorage DULU; bila gagal, JANGAN ubah state mine,
    // JANGAN tutup dialog, JANGAN toast sukses — entri tidak boleh muncul
    // di daftar padahal tidak tersimpan (sebelumnya: mineCount 1 di UI,
    // ss.mine.v1 null, hilang sesudah reload).
    const next = existing
      ? mine.map((m) => (m.id === existing.id ? entry : m))
      : [entry, ...mine];
    if (!writeLS(MINE_KEY, JSON.stringify(next))) {
      toast(ERR_MINE_SAVE, true);
      return;
    }
    setMine(next);
    setActiveMineId(entry.id);
    setSaveMineOpen(false);
    toast(existing ? `"${label}" diperbarui di Video Buatan Saya` : `"${label}" disimpan di Video Buatan Saya`);
    // Di layar kecil drawer tertutup — buka supaya video (baru / diperbarui) terlihat.
    if (window.innerWidth <= 1180) {
      closeSheet();
      setDrawerOpen(true);
      setTimeout(() => {
        document.querySelector(".mine-list .mine-item")?.scrollIntoView({ block: "nearest" });
      }, 320);
    }
  }, [saveMineLabel, fields, cur, normalize, capsChanged, draftCaps, shotsChanged, draftShots, voTouched, draftVO, propsChanged, draftProps, toast, closeSheet, activeMineId, mine]);

  const openMine = useCallback(
    (entry: MyVideo) => {
      const t = TEMPLATES.find((x) => x.file === entry.file);
      if (!t) {
        toast("Template asal tidak ditemukan");
        return;
      }
      pendingMineRef.current = entry;
      // Template asal sedang terbuka: openTemplate() no-op dan load() ulang
      // tidak me-mount (string base identik) — terapkan override langsung.
      if (cur === t && base) {
        setActiveMineId(entry.id);
        const n = { title: entry.title, sub: entry.sub, end: entry.end };
        setFields(n);
        setApplied(n);
        setDraftCaps(entry.caps ?? origCaps ?? []);
        setDraftShots(entry.shots ?? origShots ?? []);
        setDraftVO(entry.vo ?? origVO ?? null);
        // Entri mine langsung diterapkan ke preview (mount di bawah),
        // jadi baseline "diterapkan" ikut disinkronkan — kalau tidak,
        // tombol Terapkan akan tampak aktif padahal tidak ada yang pending.
        setAppliedCaps(entry.caps ?? origCaps ?? []);
        setAppliedShots(entry.shots ?? origShots ?? []);
        setAppliedVO(entry.vo ?? origVO ?? null);
        setVoTouched(!!entry.vo);
        if (entry.props) {
          setDraftProps(entry.props);
          setAppliedProps(JSON.parse(JSON.stringify(entry.props)) as PropValues);
          setArrayText((prev) => {
            const next = { ...prev };
            Object.keys(entry.props as PropValues).forEach((id) => {
              const v = (entry.props as PropValues)[id];
              if (Array.isArray(v)) next[id] = JSON.stringify(v);
            });
            return next;
          });
          setArrayErr({});
        }
        setTab("teks");
        setTimeout(() => mount(true), 0);
        return;
      }
      openTemplate(t, { push: true });
    },
    [cur, base, mount, openTemplate, origCaps, origShots, origVO, toast]
  );

  const deleteMine = useCallback(
    (id: string) => {
      // U5: tulis dulu, baru ubah state — bila gagal, entri tetap tampil
      // dan toast jujur (jangan klaim "dihapus" padahal masih tersimpan).
      const next = mine.filter((m) => m.id !== id);
      if (!writeLS(MINE_KEY, JSON.stringify(next))) {
        toast(ERR_MINE_DELETE, true);
        return;
      }
      setMine(next);
      if (activeMineId === id) setActiveMineId(null);
      toast("Video dihapus dari Video Buatan Saya");
    },
    [activeMineId, mine, toast]
  );

  /** Unduh satu entri sebagai file .html lengkap (setText+setCaps+setShots+setVO+setProps).
   *  SENGAJA tetap pakai URL CDN (bukan /vendor/): file hasil unduh harus
   *  standalone dan jalan di browser normal — lihat lib/studio.ts
   *  "VENDOR three.js". applyEdits tidak me-rewrite. */
  const downloadMine = useCallback(
    async (entry: MyVideo) => {
      try {
        const r = await fetch("/templates/" + entry.file);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const html = await r.text();
        const lens = [...html.matchAll(/LEN=([0-9.]+)/g)].map((m) => +m[1]);
        const L = lens[lens.length - 1] || 30;
        const spec: EditSpec = { file: entry.file, title: entry.title, sub: entry.sub, end: entry.end };
        if (entry.caps) spec.caps = entry.caps;
        if (entry.shots) spec.shots = entry.shots;
        if (entry.vo) spec.vo = entry.vo;
        if (entry.props) spec.props = entry.props;
        const out = applyEdits(html, spec, L);
        const blob = new Blob([out.html], { type: "text/html;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = slugify(entry.label) + ".html";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast("Mengunduh " + a.download);
      } catch (e) {
        toast("Gagal mengunduh: " + String((e as Error).message || e));
      }
    },
    [toast]
  );

  // ---------- sync loop (playhead, shot/cap aktif) ----------
  useEffect(() => {
    let lastTick = 0;
    const lite = window.matchMedia("(pointer:coarse)").matches;
    const loop = (ts: number) => {
      const gap = lite ? (playingRef.current ? 33 : 150) : 0;
      if (!gap || ts - lastTick >= gap) {
        lastTick = ts;
        const s = st();
        // Gerbang readyRef (bukan state `ready` yang bisa basi satu tick):
        // bridge BARU yang belum di-seek membaca gT()=0 dan akan meracuni
        // lastTimeRef bila dibaca di jendela reload (U6/F2).
        if (s && readyRef.current) {
          let t: number;
          try {
            t = s.gT();
          } catch {
            t = lastTRef.current;
          }
          if (Number.isFinite(t) && t >= 0) lastTimeRef.current = t;
          const prev = lastTRef.current;
          const wrapped = !seekGuardRef.current && prev > 1 && t < 1;
          seekGuardRef.current = false;
          if (t !== lastTRef.current) {
            lastTRef.current = t;
            setTime(t);
          }
          const sh = (() => {
            let k = -1;
            shots.forEach((x, i) => {
              if (t >= x[0]) k = i;
            });
            return k;
          })();
          const ca = caps.findIndex((c) => t >= c[0] && t < c[1]);
          if (sh !== lastShotRef.current) lastShotRef.current = sh;
          if (ca !== lastCapRef.current) lastCapRef.current = ca;
          if (playingRef.current && lenRef.current && !loopRef.current && (t >= lenRef.current - 0.06 || wrapped)) {
            try {
              s.pause();
              s.seek(lenRef.current - 0.01);
            } catch { /* ignore */ }
            setPlaying(false);
            lastTRef.current = lenRef.current - 0.01;
            lastTimeRef.current = lenRef.current - 0.01;
            setTime(lenRef.current - 0.01);
            lastShotRef.current = lastCapRef.current = -2;
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, shots, caps, st]);

  const activeShot = useMemo(() => {
    let k = -1;
    shots.forEach((x, i) => {
      if (time >= x[0]) k = i;
    });
    return k;
  }, [shots, time]);
  const activeCap = useMemo(() => caps.findIndex((c) => time >= c[0] && time < c[1]), [caps, time]);

  const selectClip = useCallback(
    (kind: "shot" | "cap", i: number, seek: boolean) => {
      if (kind === "shot" && !shots[i]) return;
      if (kind === "cap" && !caps[i]) return;
      setSel({ kind, i });
      setTab(kind === "shot" ? "shot" : "cap");
      openSheetIfClosed("half");
      if (seek) goTo((kind === "shot" ? shots[i][0] : caps[i][0]) + 0.01);
    },
    [shots, caps, goTo, openSheetIfClosed]
  );

  // ---------- timeline ----------
  const pct = (v: number) => clamp((v / Math.max(len, 0.001)) * 100, 0, 100);
  const fitPps = useCallback(() => {
    const vp = tlScrollRef.current?.clientWidth || 600;
    return Math.max(3, (vp - 1) / Math.max(len, 0.1));
  }, [len]);
  const applyTimelineWidth = useCallback(() => {
    const el = tlContentRef.current;
    if (!el) return;
    const w = Math.max(tlScrollRef.current?.clientWidth || 0, Math.ceil(len * tlPps), 120);
    el.style.width = w + "px";
  }, [len, tlPps]);
  const fitTimeline = useCallback(() => {
    setTlRange(0);
    setTlFit(true);
    const pps = fitPps();
    setTlPps(pps);
    // Setel lebar konten dari pps YANG SAMA (bukan dari state tlPps yang
    // masih basi): efek lebar konten jalan SEBELUM efek fit ini dalam
    // satu commit yang sama, jadi tanpa ini konten sempat 651 px
    // (pps lama dari len=30) di viewport 575 px — klip terpotong di
    // kanan + label dihitung dari lebar yang salah — sampai render
    // berikutnya mengoreksinya.
    const el = tlContentRef.current;
    if (el) {
      const w = Math.max(tlScrollRef.current?.clientWidth || 0, Math.ceil(len * pps), 120);
      el.style.width = w + "px";
    }
    if (tlScrollRef.current) tlScrollRef.current.scrollLeft = 0;
  }, [fitPps, len]);
  useEffect(() => {
    applyTimelineWidth();
  }, [applyTimelineWidth, shots, caps, len]);
  // Lebar konten timeline dalam px (untuk ambang label klip — lihat bawah).
  useEffect(() => {
    const el = tlContentRef.current;
    if (!el) return;
    const update = () => setTlContentW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (tlFit) fitTimeline();
    // Drawer ikut mengubah lebar viewport timeline (<=1180px): tanpa
    // ini fit dihitung saat drawer masih terbuka lalu tidak pernah
    // dihitung ulang sesudah drawer menutup, sehingga klip hanya
    // mengisi ~88% lebar track (ruang kosong di kanan).
  }, [len, tlFit, fitTimeline, drawerOpen]);

  const setTimelineZoom = useCallback(
    (v: number) => {
      const old = tlPps;
      const center = clamp(
        ((tlScrollRef.current?.scrollLeft || 0) + (tlScrollRef.current?.clientWidth || 0) / 2) / Math.max(old, 0.001),
        0,
        len
      );
      const range = clamp(v, 0, 100);
      const isFit = range === 0;
      setTlRange(range);
      setTlFit(isFit);
      setTlPps(isFit ? fitPps() : fitPps() * Math.pow(8, range / 100));
      if (isFit && tlScrollRef.current) tlScrollRef.current.scrollLeft = 0;
      else if (tlScrollRef.current) {
        const max = Math.max(0, tlScrollRef.current.scrollWidth - tlScrollRef.current.clientWidth);
        tlScrollRef.current.scrollLeft = clamp(center * (isFit ? fitPps() : fitPps() * Math.pow(8, range / 100)) - tlScrollRef.current.clientWidth / 2, 0, max);
      }
    },
    [tlPps, len, fitPps]
  );

  const snapTime = useCallback(
    (t: number) => {
      if (!snap || !len) return t;
      const tol = Math.max(0.03, 8 / Math.max(tlPps, 1));
      const pts = [0, len];
      shots.forEach((x) => pts.push(x[0]));
      caps.forEach((c) => {
        pts.push(c[0]);
        pts.push(c[1]);
      });
      let best = t;
      let d = tol;
      for (const p of pts) {
        const dd = Math.abs(p - t);
        if (dd < d) {
          d = dd;
          best = p;
        }
      }
      return clamp(best, 0, len);
    },
    [snap, len, shots, caps, tlPps]
  );

  const seekFromEvent = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const el = tlContentRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp(e.clientX - r.left, 0, r.width);
      goTo(snapTime((x / Math.max(1, r.width)) * len));
    },
    [goTo, snapTime, len]
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (scrubRef.current) seekFromEvent(e);
    };
    const up = () => {
      if (!scrubRef.current) return;
      const resume = scrubRef.current.was;
      scrubRef.current = null;
      if (resume) {
        const s = st();
        if (s) {
          s.play();
          setPlaying(true);
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [seekFromEvent, st]);

  // ruler ticks
  const ruler = useMemo(() => {
    const width = Math.max(120, (tlContentRef.current?.clientWidth || 600));
    const pps = width / Math.max(len, 0.1);
    const steps = [1 / 30, 1 / 15, 1 / 10, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const step = steps.find((s) => s * pps >= 72) || 120;
    const minor = step / 5;
    const count = Math.floor(len / minor + 1e-6);
    const items: { t: number; major: boolean }[] = [];
    for (let k = 0; k <= count; k++) items.push({ t: k * minor, major: k % 5 === 0 });
    const label = (t: number) => {
      if (step < 1) {
        const tt = Math.round(t * 10);
        return `${Math.floor(tt / 600)}:${pad(Math.floor(tt / 10) % 60)}.${tt % 10}`;
      }
      return `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`;
    };
    return { items, step, label, gridPx: Math.max(24, step * pps) };
  }, [len, tlPps]);

  // ---------- export ----------
  const expText = useCallback(() => {
    const n = normalize(fields);
    const o: string[] = [];
    const q = (v: string) => "'" + String(v).replace(/'/g, "'\\''") + "'";
    ([["title", "--title"], ["sub", "--sub"], ["end", "--end"]] as const).forEach(([k, flag]) => {
      if (n[k] !== def[k]) o.push(flag + " " + q(n[k].replace(/\n/g, "\\n")));
    });
    return o;
  }, [normalize, fields, def]);
  const expCmd = useMemo(() => {
    const f = cur ? cur.file : "template-code.html";
    return ["node scripts/export.mjs --file " + f, ...expText(), "--fps " + fps, "--out " + f.replace(/\.html$/, "") + ".mp4"].join(" ");
  }, [cur, expText, fps]);

  // ---------- command palette ----------
  const cmdItems = useMemo(() => {
    type Item = { g: string; label: string; hint: string; run: () => void };
    const a = (label: string, hint: string, run: () => void, off = false): Item | null => (off ? null : { g: "Aksi", label, hint, run });
    const items: Item[] = [
      a(playing ? "Jeda" : "Putar", "Space", toggle),
      a("Ke awal komposisi", "Home", () => goTo(0)),
      a("Ke akhir komposisi", "End", () => goTo(len - 0.05)),
      a(muted ? "Nyalakan suara" : "Matikan suara", "M", () => toggleMute()),
      a(loopOn ? "Matikan loop" : "Nyalakan loop", "L", () => setLoopOn((v) => !v)),
      a(guides ? "Sembunyikan garis bantu" : "Tampilkan garis bantu", "G", () => setGuides((v) => !v)),
      a("Fit timeline", "F", fitTimeline),
      a("Terapkan semua edit", "Ctrl+Enter", applyAll, !anyDirty || !ready || allErrors.length > 0),
      a("Kembalikan teks asli", "", resetText, !edited || !ready),
      a("Ekspor MP4…", "E", () => setExpOpen(true)),
      a(theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap", "D", () => setTheme(theme === "dark" ? "light" : "dark")),
      a("Panel Project", "T", () => { if (!drawerOpenRef.current) closeSheet(); setDrawerOpen((v) => !v); }),
      a("Tur singkat", "", () => setTourStep(0)),
      a("Pintasan keyboard", "?", () => setKeysOpen(true)),
    ].filter((x): x is Item => !!x);
    TEMPLATES.forEach((t, i) =>
      items.push({ g: "Template", label: t.label, hint: String(i + 1) + (cur === t ? " · aktif" : ""), run: () => openTemplate(t, { push: true }) })
    );
    caps.forEach((c, i) =>
      items.push({ g: "Caption", label: c[2], hint: fmt(c[0]), run: () => selectClip("cap", i, true) })
    );
    shots.forEach((x, i) =>
      items.push({ g: "Shot", label: "Shot " + (i + 1), hint: fmt(x[0]), run: () => selectClip("shot", i, true) })
    );
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, muted, loopOn, guides, dirty, ready, edited, theme, cur, caps, shots]);

  const cmdShown = useMemo(() => {
    const toks = cmdQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return cmdItems
      .filter((it) => {
        const hay = (it.g + " " + it.label).toLowerCase();
        return toks.every((t) => hay.includes(t));
      })
      .slice(0, 60);
  }, [cmdItems, cmdQuery]);

  const toggleMute = useCallback(() => {
    const s = st();
    const next = !muted;
    setMuted(next);
    try {
      if (s && s.mute) s.mute(next);
    } catch {
      toast("Suara diatur dari template");
      return;
    }
    toast(next ? "Suara dimatikan" : "Suara dinyalakan (butuh klik putar dulu)");
  }, [st, muted, toast]);

  // ---------- tour ----------
  // Tour langkah 0 menunjuk #drawer. Di layar <=1180px drawer tertutup
  // saat load, jadi buka dulu (dicatat di ref) dan tutup lagi saat tour
  // lanjut ke langkah berikut / selesai — kalau tidak, sorotan menunjuk
  // panel yang sedang off-canvas dan kartu menggantung tanpa target.
  const tourOpenedDrawerRef = useRef(false);
  const tourPlace = useCallback((step: number) => {
    const s = TOUR_STEPS[step];
    const el = document.querySelector(s.el) as HTMLElement | null;
    if (!el) return;
    if (step === 0 && !drawerOpen) {
      if (window.innerWidth <= 1180) tourOpenedDrawerRef.current = true;
      setDrawerOpen(true);
      closeSheet();
      return; // efek jalan lagi sesudah drawerOpen berubah → ukur ulang
    }
    // Langkah 2 menunjuk timeline: bila strip terlipat, buka dulu supaya
    // klip terukur; langkah 3 menunjuk inspector: bila sheet tertutup,
    // buka ke Half dulu. Efek tour mengukur ulang sesudah 320ms.
    if (step === 2 && sheetModeRef.current && tlCollapsedRef.current) setTlManual(true);
    if (step === 3 && sheetModeRef.current && sheetSnapRef.current === "closed") setSheetSnap("half");
    const r = el.getBoundingClientRect();
    const padPx = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = Math.max(4, r.left - padPx);
    const sy = Math.max(4, r.top - padPx);
    // Dijepit ≥0: bila drawer masih bergeser (transisi .24s), r.right bisa
    // di kiri sx sehingga lebar negatif — nilai negatif membuat deklarasi
    // width inline tidak valid dan sorotan hilang sampai diukur ulang.
    const sw = Math.max(0, Math.min(vw - 8, r.right + padPx) - sx);
    const sh = Math.max(0, Math.min(vh - 8, r.bottom + padPx) - sy);
    setTourRect({ x: sx, y: sy, w: sw, h: sh });
    const cw = 330;
    const ch = 170;
    const gap = 12;
    const m = 10;
    const clampX = (x: number) => Math.max(m, Math.min(vw - cw - m, x));
    const clampY = (y: number) => Math.max(m, Math.min(vh - ch - m, y));
    const spots: [boolean, number, number][] = [
      [sy + sh + gap + ch <= vh - m, clampX(sx + sw / 2 - cw / 2), sy + sh + gap],
      [sx + sw + gap + cw <= vw - m, sx + sw + gap, clampY(sy + sh / 2 - ch / 2)],
      [sx - gap - cw >= m, sx - gap - cw, clampY(sy + sh / 2 - ch / 2)],
      [sy - gap - ch >= m, clampX(sx + sw / 2 - cw / 2), sy - gap - ch],
    ];
    const pick = spots.find((s2) => s2[0]);
    if (pick) setTourCardPos({ x: pick[1], y: pick[2] });
    else setTourCardPos({ x: clampX(vw / 2 - cw / 2), y: sy + sh / 2 > vh / 2 ? m : vh - ch - m });
  }, [drawerOpen, closeSheet]);

  useEffect(() => {
    if (tourStep === null) return;
    if (tourStep !== 0 && tourOpenedDrawerRef.current) {
      tourOpenedDrawerRef.current = false;
      setDrawerOpen(false);
    }
    // Langkah 3 dari sheet tertutup: tourPlace memanggil setSheetSnap("half")
    // lalu langsung mengukur .inspector saat masih tertutup — sorotan jadi
    // strip 26px di dasar layar (F1). Timeout 320/1000ms tidak bisa
    // diandalkan: di headless, transisi sheet molor dan getBoundingClientRect
    // di dalam callback timer masih membaca posisi tertutup bahkan sesudah
    // 1000ms (compositor kelaparan, bacaan main thread basi). Jadi ukur
    // ulang sesudah sheet benar-benar settle: transitionend transform pada
    // sheet (sinyal utama, dari compositor), polling rect stabil via rAF
    // (pengaman bila transitionend tidak fire), dan batas keras 2,5 dtk.
    // Masuk ulang ke langkah 3 (sheet sudah Half) tidak memicu waiter:
    // pengukuran langsung sudah benar.
    const sheetOpening =
      tourStep === 3 && sheetModeRef.current && sheetSnapRef.current === "closed";
    tourPlace(tourStep);
    // Drawer terbuka dengan transisi .24s — ukur ulang sesudah settle.
    // Timeout saja tidak cukup (di headless transisi bisa molor): dengarkan
    // juga transitionend drawer, sekali saja, plus pengaman 1 dtk.
    const t = setTimeout(() => tourPlace(tourStep), 320);
    const t2 = setTimeout(() => tourPlace(tourStep), 1000);
    const drawer = document.querySelector("#drawer");
    const onEnd = () => tourPlace(tourStep);
    drawer?.addEventListener("transitionend", onEnd, { once: true });
    // --- waiter settle sheet (hanya bila langkah ini baru saja membukanya) ---
    const sheet = sheetOpening
      ? (sheetRef.current ?? (document.querySelector(".inspector") as HTMLElement | null))
      : null;
    let raf = 0;
    let cap: ReturnType<typeof setTimeout> | undefined;
    let pollDone = false;
    const stopPoll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    // transitionend sheet tetap dipasang sampai efek dibersihkan, supaya
    // koreksi akhir selalu datang dari akhir transisi yang sebenarnya —
    // sekalipun polling sempat mengukur lebih dulu saat rect kebetulan stabil.
    const onSheetEnd = (e: TransitionEvent) => {
      if (e.target !== sheet || e.propertyName !== "transform") return;
      tourPlace(tourStep);
    };
    if (sheet) {
      sheet.addEventListener("transitionend", onSheetEnd);
      // Pengaman: ukur ulang saat rect sheet stabil (dua sampel rAF sama
      // ≤1px dengan jarak ≥150ms) atau paling lambat 2,5 dtk — bila
      // transitionend tidak pernah fire (transisi terpotong / rAF tertahan).
      // rAF dipakai (bukan timer) supaya bacaan rect sinkron dengan frame
      // compositor, bukan nilai basi dari main thread.
      let lastTop = Infinity;
      let lastH = Infinity;
      let stableSince = 0;
      const poll = (now: number) => {
        if (pollDone) return;
        const r = sheet.getBoundingClientRect();
        if (Math.abs(r.top - lastTop) <= 1 && Math.abs(r.height - lastH) <= 1) {
          if (!stableSince) stableSince = now;
          if (now - stableSince >= 150) {
            pollDone = true;
            tourPlace(tourStep);
            return;
          }
        } else {
          stableSince = 0;
        }
        lastTop = r.top;
        lastH = r.height;
        raf = requestAnimationFrame(poll);
      };
      raf = requestAnimationFrame(poll);
      // Batas keras: ukur ulang SELALU sesudah 2,5 dtk, sekalipun polling
      // sudah sempat mengukur — polling bisa terkecoh "stabil" saat rect
      // masih di posisi tertutup (compositor belum memproduksi frame), dan
      // hanya transitionend / batas keras yang menjamin bacaan sesudah
      // transisi benar-benar selesai. Pengukuran ulang di sini idempotent
      // bila sorotan sudah benar.
      cap = setTimeout(() => {
        pollDone = true;
        stopPoll();
        tourPlace(tourStep);
      }, 2500);
    }
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      drawer?.removeEventListener("transitionend", onEnd);
      stopPoll();
      if (cap) clearTimeout(cap);
      sheet?.removeEventListener("transitionend", onSheetEnd);
    };
  }, [tourStep, tourPlace]);

  const endTour = useCallback(
    (done: boolean) => {
      setTourStep(null);
      setTourRect(null);
      if (tourOpenedDrawerRef.current) {
        tourOpenedDrawerRef.current = false;
        setDrawerOpen(false);
      }
      try {
        localStorage.setItem("ss.tour", "1");
      } catch { /* ignore */ }
      if (done) toast("Tur selesai — ulangi lewat Ctrl+K → Tur singkat");
    },
    [toast]
  );

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tourStep !== null) {
        const k = e.key;
        if (k === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          endTour(false);
        } else if (k === "ArrowRight" || k === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          setTourStep((s) => (s === null ? null : s >= TOUR_STEPS.length - 1 ? (endTour(true), null) : s + 1));
        } else if (k === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          setTourStep((s) => (s === null || s === 0 ? s : s - 1));
        }
        return;
      }
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const tag = (el.tagName || "").toLowerCase();
      const typing =
        (tag === "input" && (el as HTMLInputElement).type !== "range" && (el as HTMLInputElement).type !== "checkbox") ||
        tag === "textarea" ||
        tag === "select";
      // G8/U13 + N5: Ctrl/⌘+K SELALU toggle palet — bahkan saat mengetik
      // di input atau saat dialog terbuka. Dulu handler return dini bila
      // cmdOpen/expOpen/keysOpen, jadi Ctrl+K mati total saat Ekspor
      // terbuka dan tidak bisa menutup palet yang sedang terbuka.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        setCmdQuery("");
        setCmdSel(0);
        return;
      }
      // G8/U12 + U13 + V16: Esc menutup SATU lapis teratas dulu (LIFO):
      // dialog/palet (urutan dibuka) → pencarian drawer (bersihkan dulu
      // bila ada teks) → blur input → sheet → fokus viewer → drawer.
      // Dulu Esc hanya blur saat mengetik dan return dini saat dialog
      // terbuka, jadi ketiga <dialog> tak bisa ditutup Esc sama sekali
      // dan palet hanya bisa ditutup Esc bila fokus di dalam inputnya.
      if (e.key === "Escape") {
        e.preventDefault();
        if (closeTopLayer()) return;
        const inDrawerSearch = typing && (el as HTMLInputElement).type === "search" && !!el.closest("#drawer");
        if (inDrawerSearch && q) { setQ(""); el.blur(); return; }
        if (typing) { el.blur(); return; }
        if (sheetModeRef.current && sheetSnapRef.current !== "closed") stepDownSnap();
        else if (focusView) setFocusView(false);
        else if (drawerOpen) setDrawerOpen(false);
        return;
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        applyAll();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      // Slider yang sedang fokus (mis. zoom timeline): biarkan panah /
      // Home / End mengatur slider secara native — jangan seek playhead.
      if (tag === "input" && (el as HTMLInputElement).type === "range") return;
      const onBtn = tag === "button" || tag === "a" || (el as HTMLInputElement).type === "checkbox";
      const k = e.key;
      if (e.altKey && (k === "ArrowRight" || k === "ArrowLeft")) {
        e.preventDefault();
        goTo(currentTime() + (k === "ArrowRight" ? 1 : -1) / FPS);
        return;
      }
      if (e.code === "Space") {
        if (onBtn) return;
        e.preventDefault();
        toggle();
      } else if (k === "k" || k === "K") toggle();
      else if (k === "ArrowRight") {
        e.preventDefault();
        goTo(currentTime() + (e.shiftKey ? 5 : 1));
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        goTo(currentTime() - (e.shiftKey ? 5 : 1));
      } else if (k === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (k === "End") {
        e.preventDefault();
        goTo(len - 0.05);
      } else if (k === "[" || k === "]") {
        const i = activeShot;
        const n = k === "]" ? Math.min(shots.length - 1, i + 1) : Math.max(0, i <= 0 ? 0 : i - 1);
        if (shots[n]) selectClip("shot", n, true);
      } else if (k === "." || k === ",") {
        const t = currentTime();
        const next = k === "." ? caps.find((c) => c[0] > t + 0.05) : [...caps].reverse().find((c) => c[0] < t - 0.4);
        if (next) goTo(next[0] + 0.01);
        else if (k === ",") goTo(0);
      } else if (k === "m" || k === "M") toggleMute();
      else if (k === "l" || k === "L") setLoopOn((v) => !v);
      else if (k === "g" || k === "G") setGuides((v) => !v);
      else if (k === "f" || k === "F") {
        fitTimeline();
        toast("Timeline: fit");
      } else if (k === "e" || k === "E") setExpOpen(true);
      else if (k === "t" || k === "T") { if (!drawerOpen) closeSheet(); setDrawerOpen((v) => !v); }
      else if (k === "r" || k === "R") {
        if (cur) load(cur);
      } else if (k === "?") setKeysOpen(true);
      else if (k === "/") {
        e.preventDefault();
        setCmdOpen(true);
        setCmdQuery("");
        setCmdSel(0);
      } else if (k === "d" || k === "D") setTheme(theme === "dark" ? "light" : "dark");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tourStep, q, closeTopLayer, applyAll, goTo, currentTime, toggle, activeShot, shots, caps, selectClip, toggleMute, fitTimeline, toast, cur, load, theme, setTheme, len, endTour, focusView, stepDownSnap, closeSheet, drawerOpen]);

  // ---------- derived ----------
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return TEMPLATES.map((t, i) => ({ t, i })).filter(
      ({ t }) => !query || t.label.toLowerCase().includes(query) || t.file.toLowerCase().includes(query)
    );
  }, [q]);

  const nowCap = activeCap >= 0 ? caps[activeCap] : null;
  const menuItems = useMemo(() => {
    const file = [
      { label: "Ekspor MP4…", hint: "E", run: () => setExpOpen(true) },
      { label: "Muat ulang preview", hint: "R", run: () => load(cur) },
      { sep: true },
      { label: "Buka studio di tab baru", hint: "", run: () => window.open(window.location.href, "_blank") },
    ];
    const edit = [
      { label: "Terapkan semua edit", hint: "Ctrl+Enter", run: applyAll, off: !anyDirty || !ready || allErrors.length > 0 },
      { label: "Kembalikan teks asli", hint: "", run: resetText, off: !edited || !ready },
      { sep: true },
      { label: "Palet perintah…", hint: "Ctrl+K", run: () => setCmdOpen(true) },
    ];
    const comp = [
      { label: playing ? "Jeda" : "Putar", hint: "Space", run: toggle },
      { label: loopOn ? "Matikan loop" : "Nyalakan loop", hint: "L", run: () => setLoopOn((v) => !v) },
      { label: muted ? "Nyalakan suara" : "Matikan suara", hint: "M", run: toggleMute },
      { sep: true },
      { label: "Ke awal", hint: "Home", run: () => goTo(0) },
      { label: "Ke akhir", hint: "End", run: () => goTo(len - 0.05) },
    ];
    const view = [
      { label: "Panel Project", hint: "T", run: () => { if (!drawerOpenRef.current) closeSheet(); setDrawerOpen((v) => !v); } },
      { label: "Garis bantu viewer", hint: guides ? "aktif" : "nonaktif", run: () => setGuides((v) => !v) },
      { label: "Fit timeline", hint: "F", run: fitTimeline },
      { sep: true },
      { label: theme === "dark" ? "Tema terang" : "Tema gelap", hint: "D", run: () => setTheme(theme === "dark" ? "light" : "dark") },
    ];
    const help = [
      { label: "Pintasan keyboard…", hint: "?", run: () => setKeysOpen(true) },
      { label: "Tur singkat", hint: "", run: () => setTourStep(0) },
      { sep: true },
      { label: "Short Studio v3.17 · self-host", hint: "", run: () => toast("Short Studio — editor teks + timeline untuk threejs-cinematic-short") },
    ];
    return { file, edit, comp, view, help } as Record<string, { label: string; hint?: string; run: () => void; off?: boolean; sep?: boolean }[]>;
  }, [applyAll, resetText, anyDirty, allErrors, ready, edited, playing, toggle, loopOn, muted, toggleMute, goTo, len, guides, fitTimeline, theme, setTheme, load, cur, toast]);

  const fieldChanged = (k: keyof TextFields) => normalize(fields)[k] !== def[k];
  const selShot = sel?.kind === "shot" ? shots[sel.i] : undefined;
  const selCap = sel?.kind === "cap" ? caps[sel.i] : undefined;
  /** Judul konteks di header sheet (bahasa awam, tanpa istilah teknis). */
  const sheetTitle = tab === "objek"
    ? activeObj ? `Sedang mengedit: ${activeObj.name}` : "Pilih objek untuk diedit"
    : tab === "teks" ? `Edit teks — ${cur.label}`
    : tab === "shot" ? (sel?.kind === "shot" ? `Shot ${sel.i + 1} terpilih` : "Edit shot")
    : sel?.kind === "cap" ? `Caption #${sel.i + 1}` : "Edit caption";

  return (
    <div className={`app${drawerOpen ? "" : " drawer-closed"}${focusView ? " focus-view" : ""}${sheetMode ? " sheet-mode" : ""}${sheetMode ? ` sheet-${sheetSnap}` : ""}${sheetKbOpen ? " kb-open" : ""}`}>
      <header className="topbar">
        <button id="menu" className="tb-icon" aria-label="Buka atau tutup panel Project" aria-expanded={drawerOpen} title="Panel Project (T)" onClick={() => { if (!drawerOpen) closeSheet(); setDrawerOpen((v) => !v); }}>
          <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
        </button>
        <div className="brand">
          <span className="logo"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
          <b>Short Studio</b><em>v3.17</em>
        </div>
        <nav className="menubar" aria-label="Menu aplikasi">
          {(["file", "edit", "comp", "view", "help"] as const).map((key) => (
            <button
              key={key}
              data-menu={key}
              aria-expanded={menuKey === key}
              onClick={() => setMenuKey(menuKey === key ? null : key)}
            >
              {key === "file" ? "File" : key === "edit" ? "Edit" : key === "comp" ? "Komposisi" : key === "view" ? "Tampilan" : "Bantuan"}
            </button>
          ))}
        </nav>
        <div className="doc">
          <span className="doc-ico"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z" /></svg></span>
          <div className="doc-meta">
            <b>{cur.label}</b>
            <span><code>{cur.file}</code><i></i><em>1080×1920 · 60 fps</em></span>
          </div>
        </div>
        <span className="grow" />
        <div className="tb-actions">
          <button id="cmdBtn" className="tb-icon" aria-label="Palet perintah" title="Palet perintah (Ctrl+K)" onClick={() => { setCmdOpen(true); setCmdQuery(""); setCmdSel(0); }}>
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
          </button>
          <button id="keysBtn" className="tb-icon" aria-label="Pintasan keyboard" title="Pintasan keyboard (?)" onClick={() => setKeysOpen(true)}>
            <svg viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" /></svg>
          </button>
          <button id="themeBtn" className="tb-icon" aria-label="Ganti tema" title="Ganti tema (D)" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <span dangerouslySetInnerHTML={{ __html: theme === "dark"
              ? '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zM11 2v2h2V2h-2zm0 18v2h2v-2h-2zM5.99 4.58 4.58 5.99l1.41 1.41 1.41-1.41-1.41-1.41zm12.37 12.37-1.41 1.41 1.41 1.41 1.41-1.41-1.41-1.41zm1.41-10.96-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41zM7.4 17.95l-1.41-1.41-1.41 1.41 1.41 1.41 1.41-1.41z"/></svg>'
              : '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>' }} />
          </button>
          <span className="tb-sep" />
          <button id="expBtn" className="btn primary" title="Ekspor MP4 (E)" onClick={() => setExpOpen(true)}>
            <svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></svg>
            <span className="lbl">Ekspor</span>
          </button>
        </div>
      </header>
      {menuKey && (
        <div className="menu-pop" role="menu" aria-label="Menu" style={{ left: 90, top: 52 }}>
          {(menuItems[menuKey] || []).map((it, i) =>
            it.sep ? (
              <div key={i} className="mi-sep" />
            ) : (
              <button key={i} className="mi" role="menuitem" disabled={!!it.off} onClick={() => { setMenuKey(null); setTimeout(it.run, 0); }}>
                <span>{it.label}</span>
                {it.hint ? <kbd>{it.hint}</kbd> : null}
              </button>
            )
          )}
        </div>
      )}

      <main className="workspace" id="workspace">
        <aside className="panel media" id="drawer" aria-label="Project bin">
          <div className="panel-h">
            <span className="panel-t"><svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" /></svg>Project</span>
            <span className="badge">{q ? `${filtered.length}/${TEMPLATES.length}` : String(TEMPLATES.length)}</span>
            <span className="grow" />
            <button className="ph-icon" aria-label="Tutup panel Project" title="Tutup panel" onClick={() => setDrawerOpen(false)}>
              <svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg>
            </button>
          </div>
          <div className="media-tools">
            <label className="search">
              <span className="sr">Cari template</span>
              <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
              <input
                type="search"
                placeholder={`Cari ${TEMPLATES.length} short…`}
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const first = document.querySelector<HTMLElement>("#tplList .tpl");
                    first?.click();
                  }
                }}
              />
            </label>
          </div>
          <div className="media-list" id="tplList" role="list">
            {filtered.length === 0 && <div className="empty">Tidak ada template yang cocok.</div>}
            {filtered.map(({ t, i }, n) => (
              <button
                key={t.file}
                className={`tpl${cur === t ? " on" : ""}`}
                data-file={t.file}
                title={t.label}
                role="listitem"
                aria-current={cur === t || undefined}
                style={{ animationDelay: `${n * 14}ms` }}
                onClick={() => {
                  openTemplate(t, { push: true });
                  if (window.innerWidth <= 1180) setDrawerOpen(false);
                }}
              >
                <span className="tpl-poster" style={{ ["--h" as string]: (i * 47 + 205) % 360 }}>
                  <b>{pad(i + 1)}</b><i />
                </span>
                <span className="tpl-info">
                  <span className="tpl-name">{t.label}</span>
                  <span className="tpl-meta">
                    {edits[t.file] || fullEdits[t.file] ? <i className="dot" title="Diedit" /> : null}
                    {t.file.replace(/^template-?/, "").replace(/\.html$/, "") || "versus"}
                  </span>
                </span>
                <span className="tpl-dur">{t.kind || ""}</span>
              </button>
            ))}
          </div>
          <div className="mine-sec">
            <div className="mine-h">
              <span>Video Buatan Saya</span>
              <span className="badge">{mine.length}</span>
              <span className="grow" />
              <button className="btn ghost small" title={activeMineEntry ? `Perbarui "${activeMineEntry.label}" di Video Buatan Saya` : "Simpan video saat ini sebagai video baru"} onClick={() => { setSaveMineLabel(activeMineEntry ? activeMineEntry.label : (fields.title.trim() || cur.label)); setSaveMineOpen(true); }}>{activeMineEntry ? "Perbarui" : "+ Simpan"}</button>
            </div>
            {mine.length === 0 ? (
              <p className="hint" style={{ padding: "6px 9px" }}>Belum ada. Edit template apa pun lalu simpan sebagai video baru — template asli tidak pernah diubah.</p>
            ) : (
              <div className="mine-list">
                {mine.map((m) => (
                  <div key={m.id} className={`mine-item${activeMineId === m.id ? " on" : ""}`}>
                    <button className="mine-open" onClick={() => openMine(m)} title={`Buka ${m.label} (dari ${m.file})`}>
                      <b>{m.label}</b>
                      <small>dari {m.file.replace(/^template-?/, "").replace(/\.html$/, "") || "versus"} · {new Date(m.updatedAt ?? m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}{m.updatedAt ? " (diperbarui)" : ""}</small>
                    </button>
                    <button className="btn ghost small" title="Unduh sebagai file .html" onClick={() => downloadMine(m)}>Unduh .html</button>
                    <button className="btn ghost small" title="Hapus video ini" onClick={() => deleteMine(m.id)}>Hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel-foot"><b>12 short siap edit.</b><br />Pilih template, scrub di timeline, ubah teks, ekspor.</div>
        </aside>
        <div className="scrim" onClick={() => setDrawerOpen(false)} />

        <section className="panel viewer" aria-label="Composition viewer">
          <div className="panel-h">
            <span className="panel-t"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6z" /></svg><span>Comp 1 · {cur.label}</span></span>
            <span className="chip">1080×1920 · 60 fps</span>
            {tab === "objek" && activeObj && (
              <span className="chip obj-chip" title={activeObj.desc}>
                <span aria-hidden="true">{activeObj.icon}</span> Sedang mengedit: {activeObj.name}
              </span>
            )}
            <span className="grow" />
            <button className="ph-icon" aria-pressed={focusView} aria-label={focusView ? "Keluar dari fokus viewer" : "Fokus viewer — sembunyikan timeline dan transport"} title={focusView ? "Keluar dari fokus viewer (Esc)" : "Fokus viewer — sembunyikan timeline & transport"} onClick={() => { if (!focusView) closeSheet(); setFocusView((v) => !v); toast(!focusView ? "Fokus viewer — timeline disembunyikan" : "Fokus viewer nonaktif"); }}>
              <svg viewBox="0 0 24 24"><path d="M3 5h6v2H5v4H3zm18 0h-6v2h4v4h2zm-18 14h6v-2H5v-4H3zm18 0h-6v-2h4v-4h2z" /></svg>
            </button>
            <button className="ph-icon" aria-pressed={guides} aria-label="Garis bantu" title="Garis bantu (G)" onClick={() => { setGuides((v) => !v); toast(!guides ? "Garis bantu aktif" : "Garis bantu nonaktif"); }}>
              <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v4h4V5H5zm6 0v4h4V5h-4zm6 0v4h4V5h-4zM5 11v4h4v-4H5zm6 0v4h4v-4h-4zm6 0v4h4v-4h-4zM5 17v2h4v-2H5zm6 0v2h4v-2h-4zm6 0v2h4v-2h-4z" /></svg>
            </button>
            <button className="ph-icon" aria-label="Layar penuh" title="Layar penuh" onClick={() => {
              const v = document.querySelector(".viewer");
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              else if (v?.requestFullscreen) v.requestFullscreen().catch(() => toast("Layar penuh tidak didukung browser"));
              else toast("Layar penuh tidak didukung browser");
            }}>
              <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            </button>
          </div>
          <div className="viewer-body">
            <div className="viewer-canvas" id="viewerCanvas" ref={viewerCanvasRef}>
              <div className={`stage${ready ? " ready" : ""}${!playing && time < 0.1 ? " idle" : ""}`} id="stage" ref={stageRef}>
                <iframe ref={iframeRef} id="pv" title="Preview template" sandbox="allow-scripts allow-same-origin" allow="autoplay" />
                <div className="stage-hud"><span>Comp 1</span><span>1080×1920</span></div>
                <div className={`guides${guides ? " on" : ""}`} aria-hidden="true">
                  <i className="g-action" /><i className="g-title" /><i className="g-v" /><i className="g-h" />
                  <span className="g-lbl" style={{ left: "10%", top: "10%" }}>safe</span>
                  <span className="g-lbl" style={{ right: "10%", bottom: "10%" }}>title</span>
                </div>
                <div className="tap" aria-hidden="true" onClick={handleTapClick}>
                  <span className="bigplay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
                </div>
                <div className={`state${status === "err" ? " err" : ""}`} role="status" aria-live="polite">
                  <span className="spin" />
                  <span>{skelText}</span>
                  <span className="why">{skelWhy}</span>
                  <button id="retry" className="btn ghost small" onClick={() => load(cur)}>Coba lagi</button>
                </div>
              </div>
            </div>
          </div>
          <div className="now-cap" aria-live="off">
            <i style={{ background: nowCap ? SPK[nowCap[3] ?? 2] || SPK[2] : "transparent" }} />
            <span className={nowCap ? "" : "none"}>{nowCap ? nowCap[2] : playing ? "…" : "Tidak ada caption di titik ini"}</span>
            <span className="nc-time">{fmt(time)} / {fmt(len)}</span>
          </div>
          <div className="transport">
            <div className="t-group">
              <button className="tbtn" aria-label="Ke awal" title="Ke awal (Home)" onClick={() => goTo(0)}><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg></button>
              <button className="tbtn optional" aria-label="Mundur 5 detik" title="Mundur 5 detik (Shift+←)" onClick={() => goTo(time - 5)}>−5s</button>
              <button className="tbtn" aria-label="Mundur 1 frame" title="Mundur 1 frame (Alt+←)" onClick={() => goTo(time - 1 / FPS)}>−1f</button>
              <button className="play" aria-label={playing ? "Jeda" : "Putar"} title="Putar / jeda (Space)" onClick={toggle} dangerouslySetInnerHTML={{ __html: playing ? ICON.pause : ICON.play }} />
              <button className="tbtn" aria-label="Maju 1 frame" title="Maju 1 frame (Alt+→)" onClick={() => goTo(time + 1 / FPS)}>+1f</button>
              <button className="tbtn optional" aria-label="Maju 5 detik" title="Maju 5 detik (Shift+→)" onClick={() => goTo(time + 5)}>+5s</button>
              <button className="tbtn" aria-label="Ke akhir" title="Ke akhir (End)" onClick={() => goTo(len - 0.05)}><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <div className="t-center"><span className="tc"><b>{fmtTC(time, len)}</b><em>/</em><span>{fmtTC(len, len)}</span></span></div>
            <div className="t-right">
              <button className="tbtn" aria-pressed={loopOn} aria-label="Loop" title={loopOn ? "Loop aktif (L)" : "Loop nonaktif (L)"} onClick={() => { setLoopOn((v) => !v); toast(!loopOn ? "Loop aktif" : "Loop nonaktif"); }}>
                <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" /></svg>
              </button>
              <button className="tbtn" aria-pressed={!muted} aria-label={muted ? "Suara mati, klik untuk menyalakan" : "Suara menyala, klik untuk mematikan"} title={muted ? "Suara off (M)" : "Suara on (M)"} onClick={toggleMute}>
                <span dangerouslySetInnerHTML={{ __html: muted ? ICON.volOff : ICON.volOn }} />
              </button>
              <select className="vzoom" aria-label="Zoom viewer" title="Zoom viewer" value={vZoom} onChange={(e) => {
                const v = +e.target.value;
                setVZoom(v);
                try { localStorage.setItem("ss.vzoom", String(v)); } catch { /* ignore */ }
                toast(v ? `Zoom ${v}%` : "Zoom: fit");
              }}>
                <option value={0}>Fit</option>
                <option value={75}>75%</option>
                <option value={50}>50%</option>
              </select>
            </div>
          </div>
        </section>

        <section className={`panel timeline${tlCollapsed ? " tl-collapsed" : ""}`} id="timelinePanel" aria-label="Timeline" style={{ height: tlHeight }}>
          <div
            className="tl-resize"
            title="Ubah tinggi timeline"
            onPointerDown={(e) => {
              if (window.innerWidth <= 900) return;
              e.preventDefault();
              const startY = e.clientY;
              const startH = tlHeight;
              // Batas atas = tinggi baris timeline dari CSS (var --tl-h,
              // sudah memperhitungkan pita <=1180px dan viewport pendek).
              // Tanpa ini panel hasil drag (mis. 264px) meluber keluar
              // barisnya dan menutupi status bar.
              const rowCap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tl-h")) || 264;
              const maxH = Math.max(170, Math.min(window.innerHeight * 0.62, rowCap));
              const move = (ev: PointerEvent) => {
                const h = clamp(startH + (startY - ev.clientY), 170, maxH);
                setTlHeight(Math.round(h));
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                fitStage();
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
          <div className="panel-h tl-head">
            <span className="panel-t"><svg viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2z" /></svg>Timeline</span>
            <span className="chip">{fmtTC(time, len)}</span>
            <span className="grow" />
            <div className="tl-tools">
              <button className="tool tl-fold" title={tlCollapsed ? "Buka timeline untuk memilih klip" : "Lipat timeline"} aria-expanded={!tlCollapsed} onClick={toggleTlFold}>
                {tlCollapsed ? "▴ Timeline" : "▾ Timeline"}
              </button>
              <button className="tool on" aria-pressed="true" title="Alat pilih" onClick={() => toast("Alat pilih: klik klip untuk memilih, seret ruler untuk scrub")}>
                <svg viewBox="0 0 24 24"><path d="M6 3l12 9-5.5 1L15 19l-2.4 1-2.4-6L6 17V3z" /></svg>
              </button>
              <button className="tool" aria-pressed={snap} title="Snapping" onClick={() => { setSnap((v) => !v); toast(!snap ? "Snapping aktif" : "Snapping nonaktif"); }}>
                <svg viewBox="0 0 24 24"><path d="M5 3v7a7 7 0 0 0 14 0V3h-4v7a3 3 0 0 1-6 0V3H5zm0 9v3h4v-3H5zm10 0v3h4v-3h-4z" /></svg>
              </button>
              <span className="tool-sep" />
              <button className="tool" id="tlZoomOut" title="Zoom out" onClick={() => setTimelineZoom(tlRange - 10)}>−</button>
              <input type="range" id="tlZoom" min={0} max={100} value={tlRange} aria-label="Zoom timeline" onChange={(e) => setTimelineZoom(+e.target.value)} />
              <button className="tool" id="tlZoomIn" title="Zoom in" onClick={() => setTimelineZoom(tlRange + 10)}>+</button>
              <button className="tool" id="tlFit" title="Fit timeline" onClick={() => { fitTimeline(); }}>
                <svg viewBox="0 0 24 24"><path d="M4 9V4h5v2H6v3H4zm16 0h-2V6h-3V4h5v5zM4 15v5h5v-2H6v-3H4zm16 0h-2v3h-3v2h5v-5z" /></svg>
              </button>
            </div>
          </div>
          <div className="tl-body">
            <div className="tl-heads">
              <div className="ruler-spacer">TC / 60</div>
              {(["shots", "caps", "audio"] as const).map((k) => (
                <div key={k} className="trk-head" data-track={k}>
                  <span className={`trk-badge ${k === "shots" ? "v1" : k === "caps" ? "t1" : "a1"}`}>{k === "shots" ? "V1" : k === "caps" ? "T1" : "A1"}</span>
                  <span className="trk-name">{k === "shots" ? "Shots" : k === "caps" ? "Captions" : "Narasi"}</span>
                  {k !== "audio" && (
                    <>
                      <button className="trk-mini" aria-pressed={!!hiddenTracks[k]} aria-label={`${hiddenTracks[k] ? "Tampilkan" : "Sembunyikan"} track ${k}`} title="Sembunyikan track"
                        onClick={() => setHiddenTracks((p) => ({ ...p, [k]: !p[k] }))}>
                        <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
                      </button>
                      <button className="trk-mini" aria-pressed={!!lockedTracks[k]} aria-label={`${lockedTracks[k] ? "Buka kunci" : "Kunci"} track ${k}`} title="Kunci track"
                        onClick={() => setLockedTracks((p) => ({ ...p, [k]: !p[k] }))}>
                        <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" /></svg>
                      </button>
                    </>
                  )}
                  {k === "audio" && (
                    <button className="trk-mini" aria-pressed={!!hiddenTracks[k]} aria-label={`${hiddenTracks[k] ? "Tampilkan" : "Sembunyikan"} track ${k}`} title="Sembunyikan track"
                      onClick={() => setHiddenTracks((p) => ({ ...p, [k]: !p[k] }))}>
                      <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="tl-scroll" ref={tlScrollRef}>
              <div
                className="tl-content"
                ref={tlContentRef}
                style={{ ["--grid-line" as string]: ruler.gridPx + "px" }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest(".clip")) return;
                  if (!ready || !len) return;
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  scrubRef.current = { was: playing };
                  if (playing) {
                    const s = st();
                    if (s) s.pause();
                    setPlaying(false);
                  }
                  seekFromEvent(e);
                  e.preventDefault();
                }}
              >
                <div className="ruler">
                  <div className="ruler-ticks">
                    {ruler.items.map((tk, i) => (
                      <span key={i}>
                        <i className={`tick${tk.major ? " maj" : ""}`} style={{ left: pct(tk.t) + "%" }} />
                        {tk.major && <span className="tick-lbl" style={{ left: pct(tk.t) + "%" }}>{ruler.label(tk.t)}</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`track${hiddenTracks.shots ? " hidden" : ""}${lockedTracks.shots ? " locked" : ""}`} data-track="shots">
                  <div className="lane">
                    {shots.length ? shots.map((x, i) => {
                      const a = x[0];
                      const b = i + 1 < shots.length ? shots[i + 1][0] : len;
                      const cams = Array.isArray(x[1]) ? (x[1] as (string | number)[]).join(" · ") : String(x[1] ?? "camera");
                      const wPct = pct(b - a);
                      // Ambang label dalam PX + PANJANG LABEL, bukan %:
                      // "Shot N" butuh ±36px apa pun lebar timeline-nya,
                      // dan klip normal harus muat judul + durasi (±22px)
                      // + padding 12px + gap ±5px — total ±78px. Ambang
                      // 72px lama meleset: klip 73px di 1366 tetap
                      // menampilkan "Sho…" + durasi. tiny: nomor saja ·
                      // compact: "Shot N" tanpa durasi/kamera · normal:
                      // lengkap. Tooltip title tetap lengkap di semua ukuran.
                      const wPx = tlContentW ? (wPct / 100) * tlContentW : wPct * 7;
                      const labelPx = ("Shot " + (i + 1)).length * 6;
                      const cls = wPx < labelPx + 8 ? "tiny" : wPx < labelPx + 42 ? "compact" : "";
                      return (
                        <button
                          key={i}
                          className={`clip shot${activeShot === i ? " active" : ""}${sel?.kind === "shot" && sel.i === i ? " sel" : ""}${cls ? " " + cls : ""}`}
                          data-kind="shot"
                          data-i={i}
                          style={{ left: pct(a) + "%", width: wPct + "%", ["--h" as string]: (i * 47 + 205) % 360 }}
                          title={`Shot ${i + 1} · ${fmt(a)}`}
                          onClick={(e) => { e.stopPropagation(); selectClip("shot", i, true); }}
                        >
                          <span className="clip-txt"><b>{cls === "tiny" ? String(i + 1) : "Shot " + (i + 1)}</b><small>{cams}</small></span>
                          <span className="clip-time">{fmt1(b - a)}</span>
                        </button>
                      );
                    }) : (
                      <div className="clip shot empty" style={{ left: 0, width: "100%" }}>
                        <span className="clip-txt"><b>Komposisi</b><small>data shot belum tersedia</small></span>
                        <span className="clip-time">{fmt(len)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`track${hiddenTracks.caps ? " hidden" : ""}${lockedTracks.caps ? " locked" : ""}`} data-track="caps">
                  <div className="lane">
                    {caps.length ? caps.map((x, i) => {
                      // Lebar klip caption dalam px — sama seperti shot:
                      // <30px hanya singkatan pembicara (teks mustahil
                      // dibaca), 30–70px teks ellipsis dengan padding
                      // dipadatkan supaya kata pertama muat. Tooltip
                      // title tetap berisi teks lengkap + waktu.
                      const capPct = pct(Math.max(0.2, x[1] - x[0]));
                      const capPx = tlContentW ? (capPct / 100) * tlContentW : capPct * 7;
                      const tiny = capPx < 30;
                      const spkAbbr = ["Cl", "Cx", "Br"][x[3] ?? 2] || "•";
                      return (
                      <button
                        key={i}
                        className={`clip cap${activeCap === i ? " active" : ""}${sel?.kind === "cap" && sel.i === i ? " sel" : ""}${tiny ? " tiny" : capPx < 70 ? " compact" : ""}`}
                        data-kind="cap"
                        data-i={i}
                        style={{ left: pct(x[0]) + "%", width: capPct + "%", ["--c" as string]: SPK[x[3] ?? 2] || SPK[2] }}
                        title={`${x[2]} · ${fmt(x[0])}`}
                        onClick={(e) => { e.stopPropagation(); selectClip("cap", i, true); }}
                      >
                        <span className="clip-txt">{tiny ? (hasSpeaker ? spkAbbr : "") : x[2]}</span>
                      </button>
                      );
                    }) : <span className="tl-empty">Tidak ada caption di template ini.</span>}
                  </div>
                </div>
                <div className={`track${hiddenTracks.audio ? " hidden" : ""}`} data-track="audio">
                  <div className="lane">
                    <div className="clip audio" style={{ left: 0, width: "100%" }} title="Narasi Web Speech mengikuti template. Audio tidak ikut ekspor MP4.">
                      <span className="wave" />
                      <span className="clip-txt"><b>Narasi Web Speech</b><small>mengikuti template · tidak ikut ekspor</small></span>
                      <span className="clip-time">{fmt(len)}</span>
                    </div>
                  </div>
                </div>
                <div className="playhead" style={{ left: pct(time) + "%" }}><span className="ph-grip" /></div>
              </div>
            </div>
          </div>
        </section>

        <aside ref={sheetRef} className={`panel inspector${sheetMode ? ` sheet-${sheetSnap}` : ""}`} aria-label="Inspector"
          onPointerMove={onSheetPointerMove} onPointerUp={onSheetPointerUp} onPointerCancel={onSheetPointerCancel}
          onFocusCapture={onSheetFocusCapture}>
          {sheetMode && (
            <>
              <div className="sheet-handle" aria-hidden="true" onPointerDown={onSheetDragStart}><i /></div>
              <div className="sheet-head" onPointerDown={onSheetDragStart}>
                <button className="sheet-play" aria-label={playing ? "Jeda" : "Putar"} title={playing ? "Jeda (Space)" : "Putar (Space)"}
                  onClick={(e) => { e.stopPropagation(); toggle(); }} dangerouslySetInnerHTML={{ __html: playing ? ICON.pause : ICON.play }} />
                <span className="sheet-title">{sheetTitle}{anyDirty && <i className="dirty-dot" aria-label="Ada perubahan belum diterapkan" />}</span>
                <button className="btn primary sheet-apply" disabled={!ready || !anyDirty || allErrors.length > 0} title="Terapkan semua edit (Ctrl+Enter)"
                  onClick={(e) => { e.stopPropagation(); applyAll(); }}>Terapkan</button>
                <button className="sheet-chev" aria-label="Ciutkan sheet" title="Ciutkan sheet"
                  onClick={(e) => { e.stopPropagation(); stepDownSnap(); }}>⌄</button>
              </div>
            </>
          )}
          <div className="tabs" role="tablist">
            {(["teks", "shot", "cap", "objek"] as const).map((name) => (
              <button
                key={name}
                className={`tab${tab === name ? " on" : ""}`}
                role="tab"
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
              >
                {name === "teks" ? "Teks" : name === "shot" ? "Shot" : name === "cap" ? "Caption" : "Objek"}
                {name === "shot" && <span className="n">{shots.length}</span>}
                {name === "cap" && <span className="n">{caps.length}</span>}
                {name === "objek" && <span className="n">{propsAvail.length}</span>}
              </button>
            ))}
          </div>
          <div className="panes">
            {tab === "teks" && (
              <div className="pane on" data-pane="teks" role="tabpanel">
                <div className="insp-body" style={{ padding: 0 }}>
                  {(["title", "sub", "end"] as const).map((k) => (
                    <label key={k} className={`field${fieldChanged(k) ? " changed" : ""}`} data-f={k}>
                      <span>
                        {k === "title" ? "Judul" : k === "sub" ? "Subjudul" : "End card"}
                        <em>{fields[k].length}/{k === "title" ? 60 : k === "sub" ? 80 : 120}</em>
                      </span>
                      {k === "end" ? (
                        <textarea
                          id="fEnd"
                          rows={3}
                          maxLength={120}
                          value={fields.end}
                          placeholder={def.end}
                          onChange={(e) => setFields((p) => ({ ...p, end: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyAll(); } }}
                        />
                      ) : (
                        <input
                          id={k === "title" ? "fTitle" : "fSub"}
                          maxLength={k === "title" ? 60 : 80}
                          value={fields[k]}
                          placeholder={def[k]}
                          autoComplete="off"
                          onChange={(e) => setFields((p) => ({ ...p, [k]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyAll(); }
                            else if (e.key === "Enter") { e.preventDefault(); applyAll(); }
                          }}
                        />
                      )}
                    </label>
                  ))}
                  <div className="insp-stick">
                  <div className="insp-actions">
                    <button id="apply" className="btn primary" disabled={!ready || !anyDirty || allErrors.length > 0} title="Terapkan semua edit (Ctrl+Enter)" onClick={applyAll}>
                      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
                      Terapkan semua edit
                    </button>
                    <button id="reset" className="btn ghost" disabled={!ready || !edited} title="Kembalikan teks asli" onClick={resetText}>
                      <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
                      Kembalikan
                    </button>
                  </div>
                  <div className="insp-actions">
                    <button className="btn ghost" disabled={!ready} title={activeMineEntry ? "Perbarui video ini di Video Buatan Saya (template asli tidak diubah)" : "Simpan edit saat ini sebagai video baru (template asli tidak diubah)"} onClick={() => { setSaveMineLabel(activeMineEntry ? activeMineEntry.label : (fields.title.trim() || cur.label)); setSaveMineOpen(true); }}>
                      <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>
                      {activeMineEntry ? "Perbarui video ini" : "Simpan sebagai video baru"}
                    </button>
                  </div>
                  <p className="hint apply-state" role="status">{applyStateText}</p>
                  </div>
                  <p className="hint">Teks diganti di preview saja — file template di disk tidak diubah. Edit tiap template diingat selama tab terbuka.</p>
                </div>
                <dl className="prop-list">
                  <div><dt>Durasi</dt><dd>{ready ? fmt(len) : "—"}</dd></div>
                  <div><dt>Shot</dt><dd>{shots.length}</dd></div>
                  <div><dt>Caption</dt><dd>{caps.length}</dd></div>
                  <div><dt>Template</dt><dd>{cur.file}</dd></div>
                </dl>
              </div>
            )}
            {tab === "shot" && (
              <div className="pane on" data-pane="shot" role="tabpanel">
                {selShot ? (
                  <div className="sel-card">
                    <div className="sel-h">
                      <span className="sel-k">Shot terpilih</span>
                      <b>Shot {(sel?.i ?? 0) + 1}</b>
                      <span className="sel-time">{fmt(selShot[0])} → {fmt(sel && sel.i + 1 < shots.length ? shots[sel.i + 1][0] : len)}</span>
                    </div>
                    <div className="sel-grid">
                      <span>Mulai<b>{fmtTC(selShot[0], len)}</b></span>
                      <span>Durasi<b>{fmt1((sel && sel.i + 1 < shots.length ? shots[sel.i + 1][0] : len) - selShot[0])}</b></span>
                      <span style={{ gridColumn: "1/-1" }}>Kamera<b>{Array.isArray(selShot[1]) ? (selShot[1] as (string | number)[]).join(" · ") : String(selShot[1] ?? "—")}</b></span>
                      <span>Index<b>{(sel?.i ?? 0) + 1} / {shots.length}</b></span>
                      <span>Total<b>{fmt(len)}</b></span>
                    </div>
                    <div className="sel-actions">
                      <button className="btn ghost small" onClick={() => sel && selectClip("shot", (sel.i - 1 + shots.length) % shots.length, true)}>◀ Sebelumnya</button>
                      <button className="btn ghost small" onClick={() => sel && goTo(shots[sel.i][0] + 0.01)}>Ke awal</button>
                      <button className="btn ghost small" onClick={() => sel && selectClip("shot", (sel.i + 1) % shots.length, true)}>Berikutnya ▶</button>
                    </div>
                  </div>
                ) : (
                  <p className="hint">Klik klip shot di timeline untuk melihat propertinya.</p>
                )}
                <details className="insp-group" open>
                  <summary>Edit shot <em>{draftShots.length}</em></summary>
                  <div className="insp-body" style={{ padding: 4 }}>
                    {origShots === null ? (
                      <p className="hint" style={{ padding: 6 }}>Shot template ini tidak bisa di-parse (format berbeda), jadi edit shot dinonaktifkan untuk template ini.</p>
                    ) : draftShots.length ? draftShots.map((s, i) => {
                      const end = i + 1 < draftShots.length ? draftShots[i + 1][0] : len;
                      const upd = (part: 0 | 1 | 2, k: number, v: number) =>
                        setDraftShots((prev) => prev.map((x, j) =>
                          j !== i ? x
                            : part === 0 ? [v, [...x[1]], [...x[2]]] as Shot
                            : part === 1 ? [x[0], x[1].map((n, kk) => (kk === k ? v : n)), [...x[2]]] as Shot
                            : [x[0], [...x[1]], x[2].map((n, kk) => (kk === k ? v : n))] as Shot));
                      const num = (e: React.ChangeEvent<HTMLInputElement>) => {
                        const n = parseFloat(e.target.value);
                        return Number.isNaN(n) ? 0 : n;
                      };
                      return (
                        <Fragment key={i}>
                          <div className={`edit-shot${sel?.kind === "shot" && sel.i === i ? " sel" : ""}${shotErrByRow[i] ? " err" : ""}`} onClick={() => selectClip("shot", i, false)}>
                            <div className="edit-shot-h">
                              <span className="k">{pad(i + 1)}</span><b>Shot {i + 1}</b>
                              <span className="at">{fmt1(end - s[0])}</span>
                            </div>
                            <label className="edit-f">Mulai (detik)
                              <input type="number" step={0.1} min={0} max={len} value={s[0]} aria-label={`Shot ${i + 1} mulai`}
                                onClick={(e) => e.stopPropagation()} onChange={(e) => upd(0, 0, num(e))} />
                            </label>
                            <div className="edit-nums">
                              {(["Kam X", "Kam Y", "Kam Z", "Lihat X", "Lihat Y", "Lihat Z"] as const).map((lbl, k) => (
                                <label key={k} className="edit-f">{lbl}
                                  <input type="number" step={0.1} value={k < 3 ? s[1][k] : s[2][k - 3]} aria-label={`Shot ${i + 1} ${lbl}`}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => upd(k < 3 ? 1 : 2, k < 3 ? k : k - 3, num(e))} />
                                </label>
                              ))}
                            </div>
                          </div>
                          {shotErrByRow[i]?.map((e, k) => <p key={k} className="valid-err row-err">{e}</p>)}
                        </Fragment>
                      );
                    }) : <p className="hint" style={{ padding: 6 }}>Belum ada shot.</p>}
                  </div>
                </details>
                {shotVal.errors.map((e, k) => <p key={k} className="valid-err">{e}</p>)}
                {shotVal.warnings.map((w, k) => <p key={k} className="valid-warn">{w}</p>)}
                <div className="insp-stick">
                <div className="insp-actions">
                  <button id="apply-shot" className="btn primary" disabled={!ready || !anyDirty || allErrors.length > 0} title="Terapkan semua edit (Ctrl+Enter)" onClick={applyAll}>Terapkan semua edit</button>
                  <button id="reset-shot" className="btn ghost" disabled={!ready || !shotsChanged} title="Kembalikan shot asli" onClick={resetShots}>Kembalikan</button>
                </div>
                <p className="hint apply-state" role="status">{applyStateText}</p>
                </div>
                <p className="hint">Edit tersimpan di state dulu — klik Terapkan (Ctrl+Enter) untuk me-mount ulang preview dengan shot baru.</p>
              </div>
            )}
            {tab === "cap" && (
              <div className="pane on" data-pane="cap" role="tabpanel">
                {selCap ? (
                  <div className="sel-card">
                    <div className="sel-h">
                      <span className="sel-k">Caption terpilih</span>
                      <b>#{ (sel?.i ?? 0) + 1}</b>
                      <span className="sel-time">{fmt(selCap[0])} → {fmt(selCap[1])}</span>
                    </div>
                    <div className="sel-cap">{selCap[2]}</div>
                    <div className="sel-grid">
                      <span>Mulai<b>{fmtTC(selCap[0], len)}</b></span>
                      <span>Durasi<b>{fmt1(selCap[1] - selCap[0])}</b></span>
                      <span>Pembicara<b>Pembicara {Math.min(3, Math.max(1, (selCap[3] || 0) + 1))}</b></span>
                      <span>Index<b>{(sel?.i ?? 0) + 1} / {caps.length}</b></span>
                    </div>
                    <div className="sel-actions">
                      <button className="btn ghost small" onClick={() => sel && selectClip("cap", (sel.i - 1 + caps.length) % caps.length, true)}>◀ Sebelumnya</button>
                      <button className="btn ghost small" onClick={() => sel && goTo(caps[sel.i][0] + 0.01)}>Ke awal</button>
                      <button className="btn ghost small" onClick={() => sel && selectClip("cap", (sel.i + 1) % caps.length, true)}>Berikutnya ▶</button>
                    </div>
                  </div>
                ) : (
                  <p className="hint">Klik klip caption di timeline untuk melihat detailnya.</p>
                )}
                <details className="insp-group" open>
                  <summary>Edit caption <em>{draftCaps.length}</em></summary>
                  <div className="insp-body" style={{ padding: 4 }}>
                    {origCaps === null ? (
                      <p className="hint" style={{ padding: 6 }}>Caption template ini tidak bisa di-parse (format berbeda), jadi edit caption dinonaktifkan untuk template ini.</p>
                    ) : draftCaps.length ? draftCaps.map((x, i) => (
                      <Fragment key={i}>
                      <div className={`edit-cap${activeCap === i ? " on" : ""}${sel?.kind === "cap" && sel.i === i ? " sel" : ""}${capErrByRow[i] ? " err" : ""}`} onClick={() => selectClip("cap", i, false)}>
                        <span className="k">{pad(i + 1)}</span>
                        <span className="spk" style={{ background: SPK[x[3] ?? 2] || SPK[2] }} />
                        <input className="cap-text" value={x[2]} aria-label={`Teks caption ${i + 1}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setDraftCaps((prev) => prev.map((c, j) => (j === i ? [c[0], c[1], e.target.value, ...(c.length > 3 ? [c[3]] : [])] as Cap : c)))} />
                        <input className="cap-num" type="number" step={0.1} min={0} max={len} value={x[0]} aria-label={`Caption ${i + 1} mulai`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { const n = parseFloat(e.target.value); setDraftCaps((prev) => prev.map((c, j) => (j === i ? [Number.isNaN(n) ? 0 : n, c[1], c[2], ...(c.length > 3 ? [c[3]] : [])] as Cap : c))); }} />
                        <input className="cap-num" type="number" step={0.1} min={0} max={len} value={x[1]} aria-label={`Caption ${i + 1} selesai`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { const n = parseFloat(e.target.value); setDraftCaps((prev) => prev.map((c, j) => (j === i ? [c[0], Number.isNaN(n) ? 0 : n, c[2], ...(c.length > 3 ? [c[3]] : [])] as Cap : c))); }} />
                        {hasSpeaker && (
                          <select value={x[3] ?? 0} aria-label={`Caption ${i + 1} pembicara`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setDraftCaps((prev) => prev.map((c, j) => (j === i ? [c[0], c[1], c[2], +e.target.value] as Cap : c)))}>
                            <option value={0}>Claude</option>
                            <option value={1}>Codex</option>
                            <option value={2}>Bersama</option>
                          </select>
                        )}
                      </div>
                      {capErrByRow[i]?.map((e, k) => <p key={k} className="valid-err row-err">{e}</p>)}
                      </Fragment>
                    )) : <p className="hint" style={{ padding: 6 }}>Belum ada caption.</p>}
                    {!hasSpeaker && origCaps !== null && (
                      <p className="hint">Template ini tidak punya kolom pembicara.</p>
                    )}
                  </div>
                </details>
                <details className="insp-group">
                  <summary>Narasi <em>{voKindState === "literal" ? String(draftVO?.length ?? 0) : voKindState === "derived" ? "ikut caption" : "tidak ada"}</em></summary>
                  <div className="insp-body" style={{ padding: 4 }}>
                    {voKindState === "literal" && draftVO ? draftVO.map((v, i) => (
                      <label key={i} className="field">
                        <span>Suara #{i + 1}</span>
                        <input value={v} aria-label={`Narasi ${i + 1}`}
                          onChange={(e) => { setDraftVO((prev) => (prev || []).map((x, j) => (j === i ? e.target.value : x))); setVoTouched(true); }} />
                      </label>
                    )) : voKindState === "derived" ? (
                      <p className="hint">Suara di video ini mengikuti caption otomatis. Edit caption untuk mengubah narasi.</p>
                    ) : (
                      <p className="hint">Template ini tidak punya suara.</p>
                    )}
                    {voTouched && <p className="valid-warn">Suara diedit manual — tidak lagi mengikuti teks caption.</p>}
                    {voFollowNote && <p className={voKindState === "literal" ? "valid-warn" : "hint"}>{voFollowNote}</p>}
                  </div>
                </details>
                {capVal.errors.map((e, k) => <p key={k} className="valid-err">{e}</p>)}
                {capVal.warnings.map((w, k) => <p key={k} className="valid-warn">{w}</p>)}
                <div className="insp-stick">
                <div className="insp-actions">
                  <button id="apply-cap" className="btn primary" disabled={!ready || !anyDirty || allErrors.length > 0} title="Terapkan semua edit (Ctrl+Enter)" onClick={applyAll}>Terapkan semua edit</button>
                  <button id="reset-cap" className="btn ghost" disabled={!ready || (!capsChanged && !voTouched)} title="Kembalikan caption asli" onClick={resetCaps}>Kembalikan</button>
                </div>
                <p className="hint apply-state" role="status">{applyStateText}</p>
                </div>
                <p className="hint">Edit tersimpan di state dulu — klik Terapkan (Ctrl+Enter) untuk me-mount ulang preview dengan caption baru.</p>
              </div>
            )}
                        {tab === "objek" && (
              <div className="pane on" data-pane="objek" role="tabpanel">
                <div className="obj-now">
                  {activeObj ? (
                    <>
                      <span className="obj-ic big" style={{ background: activeObj.color }}>{activeObj.icon}</span>
                      <div>
                        <b>Sedang mengedit: {activeObj.name}</b>
                        <span>{activeObj.desc}</span>
                      </div>
                    </>
                  ) : (
                    <p>Pilih objek di bawah, atau ketuk objek langsung di preview.</p>
                  )}
                </div>
                <p className="hint">Template: {cur.label} — {objList.length} objek bisa diedit.</p>
                <div className="obj-pick" aria-label="Pilih objek">
                  {objList.map((o) => (
                    <button key={o.key} type="button" aria-pressed={activeObjKey === o.key}
                      className={`obj-pick-item${activeObjKey === o.key ? " on" : ""}${o.changed ? " changed" : ""}`}
                      onClick={() => setSelObj(o.key)}>
                      <span className="obj-ic" style={{ background: o.color }}>{o.icon}</span>
                      <span>{o.name}</span>
                      <em>{o.count} pengaturan</em>
                    </button>
                  ))}
                </div>
                {activeObj && (
                  <div className="insp-body" style={{ padding: 4 }}>
                    {activeObj.defs.map((def) => {
                      const v = draftProps[def.id];
                      const orig = origProps[def.id];
                      const err = propErrById[def.id];
                      const arrErr = arrayErr[def.id] ? [arrayErr[def.id]] : err;
                      if (def.kind === "number") {
                        if (def.control === "choice") {
                          return <ObjChoice key={def.id} def={def} value={typeof v === "number" ? v : typeof orig === "number" ? orig : 0} err={err} onNum={(n) => setPropValue(def, n)} />;
                        }
                        return <ObjSlider key={def.id} def={def} file={cur.file} value={typeof v === "number" ? v : typeof orig === "number" ? orig : 0} orig={orig} err={err} onNum={(n) => setPropValue(def, n)} />;
                      }
                      if (def.kind === "color") {
                        return <ObjColor key={def.id} def={def} value={typeof v === "string" ? v : typeof orig === "string" ? orig : "#d97757"} err={err} onVal={(s) => setPropValue(def, s)} />;
                      }
                      if (def.kind === "text") {
                        return <ObjText key={def.id} def={def} value={typeof v === "string" ? v : typeof orig === "string" ? orig : ""} err={err} onVal={(s) => setPropValue(def, s)} />;
                      }
                      if (def.control === "scores" && Array.isArray(v)) {
                        return <ObjScores key={def.id} def={def} value={v as number[]} err={arrErr} onArr={(nv) => applyArrayValue(def, nv, true)} />;
                      }
                      if (def.control === "curve" && Array.isArray(v)) {
                        return <ObjCurve key={def.id} def={def} value={v as number[][]} len={len} err={arrErr} onArr={(nv) => applyArrayValue(def, nv, true)} />;
                      }
                      if (def.control === "windows" && Array.isArray(v)) {
                        return <ObjWindows key={def.id} def={def} value={v as number[][]} len={len} err={arrErr} onArr={(nv) => applyArrayValue(def, nv, true)} />;
                      }
                      if (def.control === "spawns" && Array.isArray(v)) {
                        return <ObjSpawns key={def.id} def={def} value={v as number[][]} len={len} err={arrErr} onArr={(nv) => applyArrayValue(def, nv, true)} />;
                      }
                      if (def.control === "lines" && Array.isArray(v)) {
                        return <ObjLines key={def.id} def={def} value={v as string[]} err={arrErr} onArr={(nv) => applyArrayValue(def, nv)} />;
                      }
                      return (
                        <ObjJson key={def.id} def={def}
                          text={arrayText[def.id] ?? (v !== undefined ? JSON.stringify(v) : "")}
                          err={arrayErr[def.id]}
                          onText={(t) => handleArrayPropChange(def, t)} />
                      );
                    })}
                  </div>
                )}
                {propVal.errors.map((e, k) => {
                  const mt = /^([\w.]+):/.exec(e);
                  const d = mt ? propsAvail.find((p) => p.def.id === mt[1])?.def : undefined;
                  return <p key={k} className="valid-err">{d ? `${d.plain}: ${stripPropId(e)}` : stripPropId(e)}</p>;
                })}
                {propVal.warnings.map((w, k) => {
                  const mt = /^([\w.]+):/.exec(w);
                  const d = mt ? propsAvail.find((p) => p.def.id === mt[1])?.def : undefined;
                  return <p key={k} className="valid-warn">{d ? `${d.plain}: ${stripPropId(w)}` : stripPropId(w)}</p>;
                })}
                <div className="insp-stick">
                <div className="insp-actions">
                  <button id="apply-objek" className="btn primary" disabled={!ready || !anyDirty || allErrors.length > 0} title="Terapkan semua edit (Ctrl+Enter)" onClick={applyAll}>Terapkan semua edit</button>
                  <button id="reset-objek" className="btn ghost" disabled={!ready || !propsChanged} title="Kembalikan pengaturan objek asli" onClick={resetProps}>Kembalikan</button>
                </div>
                <p className="hint apply-state" role="status">{applyStateText}</p>
                </div>
                <p className="hint">Geser slider untuk melihat perubahan langsung di preview. Tekan Terapkan untuk mengunci, lalu Simpan sebagai video baru.</p>
              </div>
            )}
          </div>
          <div className="meta">
            {ready ? (<><b>{fmt(len)}</b><span className="sep">·</span>{shots.length} shot<span className="sep">·</span>{caps.length} caption</>) : "Muat template untuk melihat durasi, shot dan caption."}
          </div>
        </aside>
      </main>

      {sheetMode && sheetSnap === "closed" && (
        <button className="sheet-fab" aria-label="Buka panel edit" title="Buka panel edit" onClick={() => setSheetSnap("peek")}>✎ Edit</button>
      )}

      <footer className="statusbar">
        <span className="st-left"><i className="st-dot" data-s={status} /><span>{statusText}</span></span>
        <span className="st-mid">{statusInfo}</span>
        <span className="st-right">
          <span>1080×1920 · 60 fps</span>
          <button className="st-link" title="Palet perintah" onClick={() => { setCmdOpen(true); setCmdQuery(""); setCmdSel(0); }}>Ctrl K</button>
        </span>
      </footer>

      {expOpen && (
        <dialog open className="dlg" aria-labelledby="expH" style={{ zIndex: 80 + Math.max(0, layerStack.indexOf("exp")) }} onClick={(e) => { if (e.target === e.currentTarget) setExpOpen(false); }}>
          <div className="dlg-h"><h2 id="expH">Ekspor MP4</h2><button className="tb-icon" data-close aria-label="Tutup" onClick={() => setExpOpen(false)}><svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg></button></div>
          <div className="dlg-b">
            <div className="seg" role="group" aria-label="Frame rate">
              {[30, 60].map((f) => (
                <button key={f} data-fps={f} aria-pressed={fps === f} onClick={() => setFps(f)}>{f} fps</button>
              ))}
            </div>
            <div className="code">
              <code>{expCmd}</code>
              <button className="btn small" onClick={async () => {
                try { await navigator.clipboard.writeText(expCmd); toast("Perintah disalin"); }
                catch { toast("Teks dipilih — tekan Ctrl+C"); }
              }}>Salin</button>
            </div>
            <p className="note">{expText().length > 0 ? "Teks yang kamu ubah ikut di perintah ini. Videonya tanpa audio (Web Speech tidak bisa dirender)." : "Belum ada teks yang diubah, jadi ekspor memakai teks asli template. Videonya tanpa audio."}</p>
            {hasNonTextEdits && (
              <>
                <p className="note">Caption, shot, suara, atau pengaturan objek yang diedit tidak ikut perintah di atas — salin teks di bawah ini sebagai <code>spec.json</code>, lalu ekspor dengan <code>node scripts/export.mjs --file {cur.file} --edit spec.json --fps {fps} --out {cur.file.replace(/\.html$/, "")}.mp4</code></p>
                <div className="code">
                  <code>{specJson}</code>
                  <button className="btn small" onClick={async () => {
                    try { await navigator.clipboard.writeText(specJson); toast("Teks pengaturan disalin"); }
                    catch { toast("Teks dipilih — tekan Ctrl+C"); }
                  }}>Salin spec</button>
                </div>
              </>
            )}
            <p>Jalankan perintah di atas dari folder project (butuh Playwright + Chromium + ffmpeg, sekali saja: <code>npm i -D playwright &amp;&amp; npx playwright install chromium</code>). Skrip membuka template di Chromium headless, memanggil <code>renderAt(i/fps)</code> per frame, lalu menyambungnya dengan ffmpeg. Perkiraan: 30 detik × 60 fps = 1.800 frame.</p>
          </div>
        </dialog>
      )}

      {saveMineOpen && (
        <dialog open className="dlg" aria-labelledby="mineH" style={{ zIndex: 80 + Math.max(0, layerStack.indexOf("save")) }} onClick={(e) => { if (e.target === e.currentTarget) setSaveMineOpen(false); }}>
          <div className="dlg-h"><h2 id="mineH">{activeMineEntry ? "Perbarui video ini" : "Simpan sebagai video baru"}</h2><button className="tb-icon" data-close aria-label="Tutup" onClick={() => setSaveMineOpen(false)}><svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg></button></div>
          <div className="dlg-b">
            <label className="field">
              <span>Nama video</span>
              <input value={saveMineLabel} autoFocus autoComplete="off" placeholder={cur.label}
                onChange={(e) => setSaveMineLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmSaveMine(); } }} />
            </label>
            {activeMineEntry ? (
              <p className="note">Memperbarui entri “{activeMineEntry.label}” di Video Buatan Saya — isi ikut yang terbaru, <b>tidak membuat duplikat</b>. Nama tetap “{activeMineEntry.label}” kecuali diubah di kolom di atas. Template asli tidak diubah.</p>
            ) : (
              <p className="note">Disimpan di seksi “Video Buatan Saya” (dari {cur.file}) beserta semua edit saat ini — teks, caption, shot, suara, dan pengaturan objek. Template asli tidak diubah; entri bisa dibuka, diedit lagi, dan diunduh sebagai file .html.</p>
            )}
            <div className="insp-actions">
              <button className="btn primary" onClick={confirmSaveMine}>{activeMineEntry ? "Perbarui video" : "Simpan video"}</button>
              <button className="btn ghost" onClick={() => setSaveMineOpen(false)}>Batal</button>
            </div>
          </div>
        </dialog>
      )}

      {keysOpen && (
        <dialog open aria-labelledby="keysH" style={{ zIndex: 80 + Math.max(0, layerStack.indexOf("keys")) }} onClick={(e) => { if (e.target === e.currentTarget) setKeysOpen(false); }}>
          <div className="dlg-h"><h2 id="keysH">Pintasan keyboard</h2><button className="tb-icon" data-close aria-label="Tutup" onClick={() => setKeysOpen(false)}><svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg></button></div>
          <div className="dlg-b">
            <dl className="keys">
              <dt><kbd>Space</kbd><kbd>K</kbd></dt><dd>Putar / jeda</dd>
              <dt><kbd>←</kbd><kbd>→</kbd></dt><dd>Mundur / maju 1 detik</dd>
              <dt><kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd></dt><dd>Mundur / maju 5 detik</dd>
              <dt><kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd></dt><dd>Mundur / maju 1 frame</dd>
              <dt><kbd>[</kbd><kbd>]</kbd></dt><dd>Shot sebelumnya / berikutnya</dd>
              <dt><kbd>,</kbd><kbd>.</kbd></dt><dd>Caption sebelumnya / berikutnya</dd>
              <dt><kbd>Home</kbd>/<kbd>End</kbd></dt><dd>Ke awal / akhir</dd>
              <dt><kbd>M</kbd></dt><dd>Suara on/off</dd>
              <dt><kbd>L</kbd></dt><dd>Loop on/off</dd>
              <dt><kbd>G</kbd></dt><dd>Garis bantu viewer</dd>
              <dt><kbd>F</kbd></dt><dd>Fit timeline</dd>
              <dt><kbd>E</kbd></dt><dd>Ekspor MP4</dd>
              <dt><kbd>T</kbd></dt><dd>Panel Project</dd>
              <dt><kbd>R</kbd></dt><dd>Muat ulang preview</dd>
              <dt><kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd></dt><dd>Terapkan semua edit (teks, caption, shot, suara, pengaturan objek)</dd>
              <dt><kbd>Ctrl/⌘</kbd>+<kbd>K</kbd> atau <kbd>/</kbd></dt><dd>Palet perintah</dd>
              <dt><kbd>D</kbd></dt><dd>Ganti tema</dd>
              <dt><kbd>?</kbd></dt><dd>Dialog pintasan</dd>
            </dl>
            <button className="btn ghost small tour-again" onClick={() => { setKeysOpen(false); setTourStep(0); }}>Ulangi tur singkat</button>
          </div>
        </dialog>
      )}

      {cmdOpen && (
        <dialog open className="cmd" aria-label="Palet perintah" style={{ zIndex: 80 + Math.max(0, layerStack.indexOf("cmd")) }} onClick={(e) => { if (e.target === e.currentTarget) setCmdOpen(false); }}>
          <div className="cmd-in">
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
            <input
              placeholder="Ketik perintah, template, atau caption…"
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              autoFocus
              value={cmdQuery}
              onChange={(e) => { setCmdQuery(e.target.value); setCmdSel(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCmdSel((s) => Math.min(cmdShown.length - 1, s + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCmdSel((s) => Math.max(0, s - 1)); }
                else if (e.key === "Enter") {
                  e.preventDefault();
                  const it = cmdShown[cmdSel];
                  if (it) { setCmdOpen(false); setTimeout(it.run, 0); }
                }
              }}
            />
          </div>
          <div className="cmd-list" role="listbox">
            {cmdShown.length === 0 && <div className="empty">Tidak ada hasil.</div>}
            {(() => {
              let g = "";
              return cmdShown.map((it, i) => {
                const head = it.g !== g ? ((g = it.g), true) : false;
                return (
                  <span key={i}>
                    {head && <div className="cmd-g" role="presentation">{it.g}</div>}
                    <button
                      className={`cmd-i${i === cmdSel ? " on" : ""}`}
                      role="option"
                      aria-selected={i === cmdSel}
                      onClick={() => { setCmdOpen(false); setTimeout(it.run, 0); }}
                      onPointerMove={() => setCmdSel(i)}
                    >
                      <span className="l">{it.label}</span>
                      <span className="h">{it.hint || ""}</span>
                    </button>
                  </span>
                );
              });
            })()}
          </div>
          <div className="cmd-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> pilih</span>
            <span><kbd>Enter</kbd> jalankan</span>
            <span><kbd>Esc</kbd> tutup</span>
          </div>
        </dialog>
      )}

      {tourStep !== null && tourRect && (
        <div className="tour">
          <div
            className="tour-spot"
            style={{ left: tourRect.x + "px", top: tourRect.y + "px", width: tourRect.w + "px", height: tourRect.h + "px" }}
          />
          <div className="tour-card" style={{ left: tourCardPos.x + "px", top: tourCardPos.y + "px" }} role="dialog" aria-modal="true">
            <div className="tour-step">Langkah {tourStep + 1} dari {TOUR_STEPS.length}</div>
            <h3>{TOUR_STEPS[tourStep].t}</h3>
            <p>{TOUR_STEPS[tourStep].p}</p>
            <div className="tour-foot">
              <div className="tour-dots">{TOUR_STEPS.map((_, k) => <i key={k} className={k === tourStep ? "on" : ""} />)}</div>
              <button className="tour-skip" onClick={() => endTour(false)}>Lewati</button>
              <button className="btn ghost small" style={{ visibility: tourStep ? "visible" : "hidden" }} onClick={() => setTourStep((s) => (s === null || s === 0 ? s : s - 1))}>Kembali</button>
              <button className="btn primary small" onClick={() => (tourStep >= TOUR_STEPS.length - 1 ? endTour(true) : setTourStep(tourStep + 1))}>
                {tourStep === TOUR_STEPS.length - 1 ? "Selesai" : "Lanjut"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toastMsg ? " on" : ""}${toastErr ? " err" : ""}`} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
