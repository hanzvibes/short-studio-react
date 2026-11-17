# Verifikasi Ulang F1 — Tur langkah 3 sorotan salah di mode sheet

**Tanggal:** 2026-11-18 · **Project:** Short Studio React (`~/workspace/short-studio-react`)
**Skrip (ditulis dari nol, independen):** `verification/sheet-reverify-2026-11-18.mjs`
**Data mentah:** `verification/sheet-tour3-reverify-2026-11-18.json`
**Metode:** `npm run build` sendiri + `next start` :3000, Playwright chromium
headless + SwiftShader, profil fresh per varian (tanpa `ss.tour`), viewport
390×844 portrait dan 1440×900. Laporan fixer TIDAK dikutip sebagai bukti —
semua angka di bawah diukur ulang oleh skrip ini.

## Verdict: **LAYAK PUSH**

F1 terkonfirmasi diperbaiki di ketiga varian. Tidak ada temuan blocking baru.
Satu observasi non-blocking dicatat di §3 (sorotan masih sempat strip sesaat
sebelum settle — by-design, terkoreksi ≤2,5 dtk dan stabil sesudahnya).

## 1. Build

`npm run build` **HIJAU** — `✓ Compiled successfully`, typecheck + lint lolos.
Route `/`: **49.6 kB / First Load JS 152 kB** (sama seperti klaim fixer).

Catatan: direktori project tidak mengandung `.git`, jadi head `main 7b36e5b9`
tidak bisa diverifikasi ulang lewat git; build dijalankan pada tree yang ada.

## 2. Skenario F1 — tur langkah 3, 390×844, profil fresh

Pembanding benar: `.tour-spot` `{y:422, h:414}` menutupi bagian kelihatan
inspector Half (`y=428, h=768`, dijepit viewport). Yang salah: strip
`{y:810, h:26}`.

| Varian | `.tour-spot` akhir | `.inspector` | Snap | Menutupi | Error |
|---|---|---|---|---|---|
| (a) Klik "Lanjut" 3× | `{x:4, y:422, w:378, h:414}` | `{x:0, y:428, w:390, h:768}` | half | ✓ | 0 |
| (b) ArrowRight 3× | `{x:4, y:422, w:378, h:414}` | `{x:0, y:428, w:390, h:768}` | half | ✓ | 0 |
| (c) Masuk-ulang (Kembali → Lanjut) | `{x:4, y:422, w:378, h:414}` | `{x:0, y:428, w:390, h:768}` | half | ✓ | 0 |

Lintasan (sampel tiap ~400–800 mdtk, dari JSON):

- Klik: `t=396ms {y:810,h:26}` → `t=1111ms {y:422,h:414}` → stabil sampai
  `t=5613ms`. Terkoreksi dalam ~1,1 dtk.
- ArrowRight: `t=109ms {y:46,h:772}` (spot sedang bertransisi) →
  `t=1705ms {y:810,h:26}` → `t=2490ms {y:422,h:414}` → stabil sampai
  `t=6393ms`. Terkoreksi dalam ~2,5 dtk (di batas keras).
- Masuk-ulang: `{y:422,h:414}` sejak sampel pertama (`t=405ms`) — langsung
  benar, sesuai klaim fixer bahwa waiter tidak diperlukan bila sheet sudah Half.

Screenshot: `sheet-tour3-reverify-390-click.png`,
`sheet-tour3-reverify-390-keys.png`,
`sheet-tour3-reverify-390-reentry.png` — kartu tur "LANGKAH 4 DARI 5 /
Inspector" terlihat, outline biru mengelilingi sheet inspector (tab
Teks/Shot/Caption/Objek + field Judul/Subjudul/End card).

## 3. Observasi (non-blocking)

Sorotan **masih sempat** menampilkan nilai salah sesaat sesudah masuk langkah 3
(strip `{y:810,h:26}` di sampel awal kedua varian pertama-kali, dan
`{y:46,h:772}` saat transisi di varian keys). Ini pengukuran langsung yang
dipertahankan by-design (sorotan selalu ada sejak awal, seperti langkah 0) —
yang diperbaiki fixer adalah koreksi akhirnya, dan koreksi itu terbukti datang
≤2,5 dtk lalu stabil. Bukan temuan blocking: kondisi akhir yang dinilai F1
sudah benar di semua varian, dan masuk-ulang langsung benar.

## 4. Regresi singkat

- **Geometri sheet 390px:** Peek — stage `{x:97, y:105, w:197, h:350}`,
  snap `peek` ✓ (197×350, sesuai harapan). Half (drag handle ke atas) —
  stage tetap `{w:197, h:350}`, snap `half` ✓.
  Screenshot: `sheet-geometry-reverify-390.png`.
- **Alur edit di dalam sheet:** tab Teks → Judul `"Claude vs Codex"` diubah
  jadi `"JUDUL REVERIFY 7X9"` → tombol Terapkan (sheet-apply) aktif →
  sesudah Terapkan, judul baru ada di `srcdoc` iframe DAN di teks preview
  (`bodyHasNew: true`, cuplikan: "JUDUL REVERIFY 7X9 / kode siapa yang
  paling bagus? / @hanzvibes …"). Screenshot
  `sheet-edit-reverify-390.png` menunjukkan judul baru besar di frame video
  dan badge "diubah" di field Judul.
- **Desktop 1440×900:** tur langkah 3 — spot
  `{x:1109, y:47, w:323, h:826}` menutupi inspector
  `{x:1115, y:53, w:320, h:814}` ✓; stage `{w:226, h:401}` (layout lama) ✓;
  screenshot `sheet-tour3-reverify-1440.png` (outline biru mengelilingi
  panel inspector kanan).
- **Console/pageerror:** **0 console error / 0 pageerror di semua 5 run**
  (3 varian tur + regresi sheet/edit + desktop).

## 5. Sisa debug di `components/Studio.tsx`

`grep -n "console.log" components/Studio.tsx` → **0 hasil** — tidak ada sisa
instrumentasi fixer. Efek tur (settle waiter: `transitionend` transform +
polling rAF rect stabil + batas keras 2,5 dtk) dibaca langsung di file,
baris ~2113–2207, sesuai deskripsi mekanisme fixer.

## 6. Catatan pelaksanaan

- Run pertama skrip ini crash di alur edit karena bug skrip saya sendiri
  (sheet masih `closed` sesudah tur dilewati → `#fTitle` tidak visible);
  diperbaiki dengan membuka sheet via FAB sebelum mengukur Peek, lalu run
  penuh kedua selesai exit 0. Bukan cacat produk.
- Kolom `step` di JSON bernilai `null` karena regex pendeteksi langkah skrip
  saya (`/(\d)\s*\/\s*5/`) tidak cocok dengan format kartu ("LANGKAH 4 DARI
  5"); identitas langkah dikonfirmasi lewat teks kartu di screenshot, bukan
  lewat regex itu.
- Yang belum diuji (sama seperti laporan fixer): tablet/perangkat nyata —
  timing visual transisi .28 dtk di perangkat tetap perlu cek Rehan.
