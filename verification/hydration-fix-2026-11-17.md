# Perbaikan React Hydration Error #418 — Short Studio React

**Tanggal:** 17 November 2026 (WIB)
**Pelaksana:** subagent fixer (tidak push — koordinator yang push)
**Rujukan bug:** `verification/mobile-verify-2026-11-17.md` §9 (verifikator independen, reproduksi 3×)
**File diubah:** `components/Studio.tsx` saja (1 file, +~30/−~15 baris)

## 1. Penyebab

Dua state diinisialisasi **lazy dari `localStorage` di `useState` initializer**:

- `mine` — `components/Studio.tsx:117-124` (lama): `useState(() => JSON.parse(localStorage.getItem("ss.mine.v1") || "[]"))`
- `fullEdits` — `components/Studio.tsx:109-116` (lama): `useState(() => JSON.parse(localStorage.getItem("ss.edits.v1") || "{}"))`

Saat SSR, `localStorage` tidak ada → `catch` → server me-render `mine = []` dan `fullEdits = {}`.
Saat hidrasi, initializer klien membaca simpanan nyata → klien me-render daftar
"Video Buatan Saya" (badge + `.mine-item`) dan titik biru "Diedit" di kartu template
→ HTML awal berbeda dari server → React error #418 pada **setiap** load/reload
bagi pengguna yang pernah menyimpan ≥1 video atau ≥1 edit per-template.

**Koreksi atas laporan verifikator:** bukan hanya `mine` yang memicu. Uji C3 verifikator
menyimpulkan "seed `ss.edits.v1` saja → 0 error", tetapi seed-nya memakai kunci
`"code"` — sedangkan `fullEdits` dikunci oleh **nama file template**
(`"template-code.html"`). Dengan kunci yang benar, `ss.edits.v1` saja **juga**
memicu #418 (1×, `args[]=HTML`, titik "Diedit" ter-render). Jadi kedua state
harus diperbaiki, dan keduanya diperbaiki di sini.

State lain yang diperiksa dan **tidak** bermasalah: `edits` (init `{}`,
tidak pernah dibaca dari localStorage — hanya transient dalam sesi);
`ss.theme` / `ss.drawer` / `ss.last` / `ss.vzoom` / `ss.tour` — semuanya
hanya dibaca di dalam `useEffect`/callback (sesudah hidrasi), bukan saat render.
Tidak ada `suppressHydrationWarning` di codebase, dan perbaikan ini tidak
memakainya — mismatch-nya diperbaiki di akar, bukan ditambal.

## 2. Perubahan (`components/Studio.tsx`)

Pola yang dipakai: **inisialisasi kosong (identik dengan server) + muat dari
localStorage di efek mount + gate `restored`** — tanpa `suppressHydrationWarning`.

| Lokasi (baru) | Perubahan |
|---|---|
| Baris ~109-119 | `fullEdits` → `useState({})`, `mine` → `useState([])` (tanpa initializer localStorage); tambah `const [restored, setRestored] = useState(false)` + komentar penjelasan |
| Baris ~590-608 | **Efek restore baru** (mount saja): baca `ss.edits.v1` + `ss.mine.v1` dari localStorage (try/catch, fallback `{}`/`[]` bila rusak), `setFullEdits`/`setMine`, lalu `setRestored(true)` |
| Baris ~609-627 | Efek init (hash/last template, tema, drawer, zoom) kini **gate `if (!restored) return`** dan dependensi `[restored]` (sebelumnya `[]`). Penting: tanpa gate ini, `load(first)` pertama akan memakai `fullEdits={}` dan edit tersimpan tidak diterapkan ke template pertama — regresi diam-diam |
| Baris ~629-637 | Efek persistensi `ss.edits.v1` kini **gate `if (!restored) return`** + dep `[fullEdits, restored]`. Tanpa gate ini, efek mount pertama akan menimpa simpanan lama dengan `{}` (nilai awal kosong pasca-fix) sebelum restore sempat membacanya. `mine` tidak punya efek persistensi (ditulis langsung di `confirmSaveMine`/`deleteMine`), jadi tidak ada risiko yang sama di sana |

Perilaku yang dipertahankan: galeri muncul sesudah mount (satu commit sesudah
hidrasi — tidak ada flash/kedip yang mengganggu; item sudah tampil saat
"Preview siap"), video tersimpan bisa dibuka/diedit, tidak ada data yang hilang.

## 3. Bukti verifikasi

Metode: `npm run build` + Playwright 1.65.1 + `chrome-headless-shell`
(`~/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/`), server
lokal di-restart sesudah rebuild (`npm start -- --port 3000`, HTTP 200),
three.js CDN di-intercept lokal seperti verifikator. Skrip:
`/tmp/hydration-probe.mjs` (sebelum/sesudah, skenario sama),
`/tmp/hydration-regression.mjs` (regresi). Data mentah:
`/tmp/hydration-baseline.json`, `/tmp/hydration-after.json`,
`/tmp/hydration-regression.json`.

### 3.1 Build — HIJAU

`npm run build`: `✓ Compiled successfully in 4.9s`, `Generating static pages (4/4)`,
tanpa error. Route `/`: 29.5 kB / First Load JS 132 kB (sama seperti sebelum fix).

### 3.2 Headless — sebelum vs sesudah (skenario identik, 390×844)

| Skenario | Sebelum (error #418) | Sesudah |
|---|---|---|
| C1 kontrol: localStorage kosong, load + reload | 0 | **0** |
| C2: seed `ss.mine.v1` 1 entri, load segar | **1× #418** | **0** — "Seed Test" tampil, badge `1` |
| C2b: seed `ss.mine.v1` 3 entri, load + reload | **2× #418** (1 per load) | **0** — "Seed 1/2/3" tampil, badge `3` |
| C3: seed `ss.edits.v1` kunci benar (`template-code.html`), load segar | **1× #418** | **0** — titik "Diedit" tampil, field Judul = `"JUDUL EDIT SEED"` (edit tetap diterapkan ke template pertama — gate `restored` bekerja) |
| C4: mine 1 + edits bersamaan | **1× #418** | **0** — "Seed Test" tampil |

Total: **sebelum 5× #418** di 4 skenario berisi simpanan → **sesudah 0** di semua
skenario, termasuk kontrol kosong (tetap 0).

### 3.3 Regresi — semua HIJAU, 0 error di tiap langkah

- **R1 simpanan tidak tertimpa:** sesudah load dengan seed mine+edits,
  `localStorage ss.mine.v1` dan `ss.edits.v1` byte-identik dengan seed
  (`mineIntact: true`, `editsIntact: true`) — efek persistensi tidak menimpa.
- **R2 buka video tersimpan:** klik "Seed Test" di drawer → judul
  `"Claude vs Codex vs Gemini · Short Studio"`, bridge `len 32`, 0 error.
- **R3 simpan baru via UI + reload:** dialog "+ Simpan" → nama `"Video Baru Fix"`
  → tersimpan, badge `1`, sesudah reload tetap ada, 0 error.
- **R4 mobile 390px:** load `drawer-closed`, `scrollWidth 390 = innerWidth`
  (tanpa overflow-x); ☰ membuka (`drawer-open`) → ✕ menutup (`drawer-closed`);
  tab Teks/Shot/Caption/Props semua bisa diklik (aktif: Teks, Shot10, Caption8,
  Props12); sesudahnya tetap tanpa overflow-x; 0 error.

### 3.4 Screenshot bukti (`verification/`)

- `mobile-390-hydration-fixed.png` — drawer terbuka 390px: seksi
  "Video Buatan Saya ①" berisi "Seed Test / dari trio · 6 Nov" + tombol
  Unduh .html / Hapus; template trio aktif; "Preview siap".
- `mobile-390-hydration-gallery.png` — stage menampilkan judul hasil edit
  tersimpan `"JUDUL EDIT SEED"` (bukti edit per-template dipulihkan dan
  diterapkan), "Preview siap", 0 error.

## 4. Yang TIDAK diubah

- `public/templates/` — 12 file tidak disentuh (tidak ada file yang diubah di sana).
- Tidak ada `suppressHydrationWarning` yang ditambahkan.
- Tidak ada perubahan UI, CSS, layout, drawer, editor, timeline, atau logika
  template/edit/simpan selain alur init/restore di atas.
- Tidak ada push/merge — diserahkan ke koordinator.
- Server lokal `npm start -- --port 3000` masih berjalan di VM (build baru);
  koordinator boleh mematikannya sesudah selesai.
