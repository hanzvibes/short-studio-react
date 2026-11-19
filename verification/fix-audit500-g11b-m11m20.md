# Perbaikan Audit-500 — G11b: Polish MINOR M11–M20 (Short Studio React)

Gelombang polish TERAKHIR. Semua BLOCKER + MAJOR + M1–M10 sudah merge (main `41f63ed6`).
Laporan audit final (read-only): `verification/audit-500-2026-11-18.md`.
Laporan kelompok sebelumnya: `verification/fix-audit500-g11a-m1m10.md` (dibaca dulu; tidak dikerjakan ulang).

- **Tanggal:** 2026-11-19 (WIB)
- **Server tes:** `npm start -- --port 3322` (PID akhir 10493, build terbaru), headless
  `~/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell`
- **Build:** `npm run build` hijau (2× — sesudah perbaikan awal dan sesudah perbaikan
  spesifisitas FAB). `npx tsc --noEmit` exit 0.
- **Sync-check:** `node scripts/sync-check.mjs` → **SEMUA HIJAU** (12/12 template
  byte-identik lib == mjs; vendor three.js 12/12 rewrite + export tetap CDN).
- **Regresi:** fresh load 12/12 → **0 error / 0 warning** validasi bawaan;
  alur edit → Terapkan → Simpan → reload hijau (entri "Video Regresi G11B" bertahan
  sesudah reload, judul "Judul Regresi G11B" kembali saat entri dibuka, tombol
  Perbarui aktif). `pageErrors: 0` di semua run verifikasi.
- **Template asli tidak tersentuh:** `public/templates/` 12/12 mtime tetap
  `2026-11-17 08:19:01`.
- **Tidak di-push / tidak di-branch / tidak di-merge** — koordinator yang push.
- **Bukti mentah (di luar repo):** `~/workspace/g11b/verify-after.json`,
  `verify2-after.json`, `verify3-after.json`, `regress-after.json`,
  skrip `harness.mjs`, `verify.mjs`, `verify2.mjs`, `verify3.mjs`, `regress.mjs`,
  `shots.mjs`, `debug-*.mjs`.

Catatan probe (jebakan yang sama seperti M7 di G11a, terulang 3× di sini):
sesudah Terapkan/Kembalikan, preview di-reload ~1–2 dtk dan semua tombol inspector
nonaktif selama `!ready`. Mengukur/mengklik di jendela itu memberi hasil palsu
(Simpan tampak "nonaktif sesudah Terapkan", dot M14 tampak "tetap menyala").
Tunggu yang benar: poll `disabled === false` pada tombol yang mau diklik.

---

## M11 — Hint/pesan salah + istilah teknis bocor

### Tidur: SUDAH HILANG (G11a) — tidak dikerjakan ulang
Hint `claude.color` sudah benar: "Warna maskot oranye — di sebagian video, garis
tepi balon kata ikut berubah."

### Rapat — TERKONFIRMASI, diperbaiki
- **Sebelum:** slider `meeting.end` ke 10 → "Tidak bisa ke 10.00 detik —
  meeting.end 10 harus sesudah jendela ketik terakhir (23.2) — timer/confetti/layar
  baca MEET_END yang sama. Nilai yang dipakai tetap 24.20 detik."
- **Sesudah:** "Tidak bisa ke 10.00 detik — waktu rapat selesai (10 dtk) harus
  sesudah ketikan terakhir selesai (23.2 dtk). Nilai yang dipakai tetap 24.20 detik."
  Tanpa `meeting.end` / `MEET_END` / "jendela ketik".
- Screenshot: `fix-audit500-g11b-m11m20-after-m11-meeting-end.png`

### Deploy — TERKONFIRMASI, diperbaiki
- **Sebelum** (seed `ss.edits.v1` pipeline tidak valid `[[[0,99]],[[0,5]]]`):
  "screen.pipeline daftar 1 tahap 1: harus 0 <= mulai < selesai <= durasi video
  (29 detik)."
- **Sesudah:** "daftar 1 tahap 1 mulainya harus sebelum selesai, dan selesai tidak
  boleh lewat durasi video (29 detik)." Tanpa `screen.pipeline`, tanpa notasi
  matematika.
- Screenshot: `fix-audit500-g11b-m11m20-after-m11-pipeline.png`

### Sapuan
42 pesan validator per file diubah bentuknya (`${id} baris/daftar/…` tanpa titik-dua
→ `${id}: …`) supaya `stripPropId` (regex `^[\w.]+( dan [\w.]+)?:\s*`) mengupas id
dan `propErrById` menempelkan error ke baris kontrolnya. Token teknis dihapus:
`typing jendela #N` → `typing.windows: ketikan baris #N:…`;
`WIN (n) != TL (n)` → "jumlah jendela ketik (n) tidak sama dengan jumlah baris
ketikan (n)"; `[detik, persen]` / `[mulai, selesai]` / `[detik, nama, pesan, warna]`
→ bahasa awam; kode warna chat `ORG/BLU/…` → "Oranye, Biru, Kuning, Hijau, Merah";
dump JSON `(dapat […])` di skor dihapus. Sisa token `MEET_END`/`WIN`/`TL` hanya di
komentar, nama anchor kode, dan pesan internal khusus CLI (`crossCheckFinal`:
"WIN/TL tidak ditemukan/gagal di-parse di HTML akhir") — bukan permukaan UI.
Komentar "cek silang WIN/TL + meeting.end" di `Studio.tsx` juga diganti bahasa awam
(2 tempat).

**File diubah:** `lib/studio.ts`, `scripts/apply-edit.mjs` (sapuan 42 pesan per file,
cermin sinkron — sync-check hijau membuktikannya).

---

## M12 — Rentang tidak konsisten (Tidur `claude.x`: UI −2..2 vs CLI −3..3)

- **Sebelum:** UI slider `claude.x` min/max `-2..2`; CLI
  `node scripts/apply-edit.mjs --list-props template-sleep.html` menampilkan
  `claude.x = 0 — … (angka -3..3)`.
- **Sesudah:** CLI menampilkan `(angka -2..2)` — sama dengan UI. Akar: `listProps`
  memakai `p.def.min/max` dan mengabaikan `rangeByFile` (validasi `validateProps`
  di lib+mjs sudah benar memakai `rangeFor`). Rentang yang benar adalah −2..2
  (dari `rangeByFile` template Tidur).
- Sapuan cepat prop lain: tidak ditemukan ketidakkonsistenan UI↔CLI lain
  (validasi memakai `rangeFor` di kedua sisi; `listProps` adalah satu-satunya
  permukaan yang melewatkannya).
- Verifikasi: CLI sebelum rebuild sudah `-2..2`; UI sesudah rebuild min `-2`,
  max `2`, step `0.05`.

**File diubah:** `scripts/apply-edit.mjs:4729-4747` (`listProps` kini memakai
`rangeFor(p.def, base)`; cermin `validateProps` di `lib/studio.ts:4828`).

---

## M13 — "+ Tambah baris" nonaktif tanpa penjelasan (Kuota, kurva tangki)

- **Sebelum:** kurva 18 baris, terakhir `[40.0, 0%]`, `addDisabled: true`, tidak ada
  hint.
- **Sesudah:** hint muncul di bawah tombol: "Baris terakhir sudah di ujung video
  (40.0 dtk dari 34 dtk) — hapus baris terakhir dulu untuk menambah baris baru."
  Sesudah baris terakhir dihapus, `addDisabled` kembali `false` (audit menyebut itu
  sudah berfungsi — terverifikasi).
- Hint yang sama ditambahkan di `ObjWindows` ("Jendela terakhir berakhir di …"),
  `ObjChat` (varian baris), `ObjCatapults` ("Tembakan terakhir …"). `ObjSpawns`
  sengaja tidak — tombolnya per-sisi "Tambah waktu muncul", bukan "Tambah baris".
- Screenshot: `fix-audit500-g11b-m11m20-after-m13-kuota.png`

**File diubah:** `components/Studio.tsx:413` (ObjCurve), `:465` (ObjWindows),
`:678` (ObjChat), `:740` (ObjCatapults).

---

## M14 — Entri basi `ss.edits.v1` + dot "Diedit" sesudah Kembalikan (Bom)

**SUDAH HILANG di G3 — dibuktikan ulang, tidak dikerjakan ulang.**
Probe awal yang tampak menunjukkan dot tetap menyala adalah **artefak probe**
(klik `.click()` mendarat saat tombol Kembalikan disabled sementara selama
preview live-reload sesudah Terapkan — jebakan yang sama seperti M7 di G11a).
Bukti benar (`~/workspace/g11b/probe-m14b.mjs`, poll `disabled === false`):
fresh dot false → sesudah Terapkan dot true, `ss.edits.v1` berisi edit → sesudah
Kembalikan dot false, `ss.edits.v1 = {}`, judul kembali "Misi Mustahil" → sesudah
reload tetap "Misi Mustahil". Verifikasi sesudah (build baru): sama —
`m14_after_reset {dot: false, edits: {}}`. Dot ada di drawer:
`.tpl-item.dot[title="Diedit"]`.

---

## M15 — Dialog menempel tepi atas viewport (y=0)

- **Sebelum:** dialog `.dlg` Ekspor/Simpan top=8 di 768×1024, 834×1112, 1180×800,
  1366×768. Dialog Pintasan (tanpa class, dibuka via `?`): **top=0** di 768×1024
  dan 390×844, gap kanan 149 (768) / 12 (390). Palet `.cmd`: **top=0** semua lebar.
- **Sesudah:** `dialog { margin: auto; top: 16px; }` — semua dialog. Terukur:
  Ekspor top=24, Pintasan top=16, palet top=16 di 768×1024, 834×1112, 1180×800,
  1366×768; di 390 landscape (844×390) ketiganya top=16 dan `fits: true`
  (Ekspor bottom 335 ≤ 390, Pintasan 339 ≤ 390). Gap kanan tetap bermargin via
  `width: min(470px, 100vw − 24px)`.
- Catatan: Ekspor/Simpan terukur top=24, bukan 16 seperti Pintasan/palet —
  selisih 8px ini tidak dijelaskan, tapi tidak berbahaya (margin ≥16px di semua
  dialog, semua muat).

**File diubah:** `app/globals.css:691`.

---

## M16 — Sheet Full ruang kosong ~300–350px di tab Teks

- **Sebelum:** sheet-full 768×1366: `panesScrollH = panesClientH = 1176` (tidak bisa
  scroll), konten berakhir y=607, inspector bawah y=1338 → **ruang kosong 731px**
  (audit menyebut 300–350px di viewport lebih pendek). Akar: tinggi inspector Full
  selalu `100dvh − 76px` sementara konten Teks ~560px.
- **Sesudah (keputusan: sheet menyesuaikan tinggi konten):** Full 768×1024 dan
  834×1180: `inspH` 567px (dari 948/1104), `panesScrollH = panesClientH = 453`,
  **ruang kosong di bawah konten 8px** (dari 731px). Tombol Terapkan tetap di
  tempatnya (baris aksi sheet tetap terlihat; konten tidak berubah).
- Screenshot: `fix-audit500-g11b-m11m20-after-m16-full-teks-768.png`,
  `...-after-m16-full-teks-834.png`
- Catatan: screenshot sebelum `...-before-m16-full-teks-1180.png` BUKAN sheet mode
  (1180 landscape) — jangan dipakai sebagai bukti M16.

**File diubah:** `app/globals.css:803` (`.sheet-full{height:auto;max-height:
calc(100dvh - 76px)}`, `.sheet-full .panes{flex:1 1 auto}`,
`.kb-open .sheet-full{max-height:calc(var(--vv-h,100dvh) - 76px)}`).

---

## M17 — Tombol "salin" putih-di-atas-putih di tema terang (dialog Ekspor)

- **Sebelum:** tema terang: color `rgb(255,255,255)` di bg `rgb(239,240,242)`,
  rasio kontras **1.14:1**.
- **Sesudah:** `.code .btn` latar permanen `#2a2d33` — kontras **13.8:1** di tema
  terang DAN gelap (diukur di kedua tema).
- Screenshot: `fix-audit500-g11b-m11m20-after-m17-salin-light.png`,
  `...-after-m17-salin-dark.png`

**File diubah:** `app/globals.css:415`.

---

## M18 — Klip audio "Narasi Web Speech" baris-2 terpotong di tepi bawah strip

- **Sebelum:** rect overflow 0px (1024×768), −2px (768×1024, 390×844) — tidak
  terpotong menurut rect; tapi screenshot sebelum menunjukkan baris-2 ("mengikuti
  template · tidak ikut ekspor") mepet tepi bawah strip (klip 20–28px vs teks dua
  baris ~23px).
- **Sesudah:** klip audio jadi satu baris (`flex-direction: row`, label + teks
  berdampingan): overflow −6px (1024×768), −8px (768×1024, 390×844) — ada ruang
  lega di bawah teks. `clipH` 23px (1024×768) / 27px (768×1024, 390×844).
- Screenshot: `fix-audit500-g11b-m11m20-after-m18-audio-768x1024.png`

**File diubah:** `app/globals.css:268` (`.clip.audio .clip-txt{flex-direction:row;
align-items:center;gap:4px}`, `b{flex:0 0 auto}`, `small{flex:1;min-width:0}`).

---

## M19 — Ruler

Ketiganya terkonfirmasi sebelum perbaikan; ketiganya diperbaiki.

| Kasus | Sebelum | Sesudah |
|---|---|---|
| (a) 390 portrait, label "0:30" | right=411 vs vw 390 → overflow 21px | right=382, overflow −8px; `scrollW 381 vs clientW 380` |
| (b) 768×1366, tick keluar viewport | `scrollW 784 vs clientW 758` (overflow 26px) | `scrollW 759 vs clientW 758` (sisa 1px = lebar tick terakhir sendiri di 100% — dapat diabaikan) |
| (c) 1440 t=0, grip menutupi "0:00" | overlap 21px² (grip 390..401, label 398..421) | overlap **0** (label kiri 407, grip kanan 401) |

Perbaikan: label `t <= 0` → `translateX(12px)` (melewati grip); label
`pct >= 99.5` → `translateX(calc(-100% - 3px))` (label akhir berakhir di tick);
tengah tetap CSS `translateX(3px)`.
Screenshot: `fix-audit500-g11b-m11m20-after-m19-ruler-390.png`,
`...-after-m19-ruler-1440-t0.png`

**File diubah:** `components/Studio.tsx:3505`.

---

## M20 — Lain-lain

### Half: Terapkan 3px di bawah viewport (390)
- **Sebelum:** `#apply` bottom 808 < vh 844 (terlihat), tapi `.insp-stick` bottom
  **884** (40px di bawah viewport); `panesScrollH = panesClientH = 654` (tidak
  bisa scroll). Akar: `.panes` setinggi inspector penuh (100dvh−76) padahal yang
  kelihatan hanya min(46dvh,480).
- **Sesudah:** `panesScrollH 485 vs panesClientH 276` (bisa scroll);
  `applyBottom 734`, `stickBottom 810` < 844 tanpa scroll; sesudah scroll ke bawah
  `applyBottom 599`, `applyVisible: true`. Peek sengaja TIDAK dibatasi (Terapkan di
  peek sudah selalu terlihat di sheet-head).
- Screenshot: `fix-audit500-g11b-m11m20-after-m20-half-390.png`

**File diubah:** `app/globals.css:812` (`.sheet-half .inspector .panes{max-height:
calc(min(46dvh,480px) - 112px)}`; chrome sheet = gagang 20 + kepala 56 + tab 36).

### Tombol tema + pintasan disembunyikan ≤600px (390)
- **Sebelum:** `#themeBtn`/`#keysBtn` display none di 390; `#cmdBtn` tampil.
- **Sesudah (keputusan: tampilkan kembali `#themeBtn` saja):** `#themeBtn`
  display grid, lebar 28px; `#keysBtn` tetap disembunyikan (dijangkau lewat palet
  perintah via `cmdBtn`); topbar 390 muat — `topbarScrollW = topbarClientW = 390`,
  overflow 0 (brand disembunyikan ≤400px, jadi ada ruang).
- **File diubah:** `app/globals.css` (baris `.tb-actions #themeBtn{display:none}`
  di `@media (max-width:600px)` dihapus).

### "Simpan sebagai video baru" hanya di tab Teks (F10/L5/B12)
- **Sebelum:** Shot/Caption/Objek tidak punya tombol Simpan; hint Objek "…lalu
  Simpan sebagai video baru" mengarahkan ke tombol yang tidak ada.
- **Sesudah (keputusan: tambah tombol Simpan di semua tab, bukan hanya perbaiki
  hint):** tombol `save-shot` / `save-cap` / `save-objek` di baris `insp-actions`
  kedua tiap tab (ikon svg sama seperti Teks); tombol Teks dapat id `save-teks`;
  tombol drawer "+ Simpan" dapat id `save-drawer`. Semuanya
  `disabled={!ready || !hasAnyEdit}`. Hint Objek kini benar.
- Screenshot: `fix-audit500-g11b-m11m20-after-m20-save-shot.png`
- **File diubah:** `components/Studio.tsx:3295` (drawer), `:3681` (teks),
  `:3774` (shot), `:3871` (cap), `:3984` (objek).

### Simpan aktif tanpa edit (L2/M3)
- **Sebelum:** tombol Teks `disabled: false` saat fresh.
- **Sesudah (keputusan: nonaktifkan bila belum ada perubahan vs ASLI):**
  `hasAnyEdit = edited || capsChanged || shotsChanged || propsChanged || voTouched`
  (vs default template, bukan vs sudah-diterapkan). Fresh: keempat tab
  `disabled: true` + title "Belum ada perubahan — edit dulu, baru simpan".
  Sesudah edit judul: aktif. Sesudah Kembalikan: nonaktif lagi. Sesudah Terapkan:
  tetap aktif (edit belum tersimpan sebagai video) — terverifikasi
  (`saveEnabledAfterApply: true`, sesudah preview selesai reload ~2 dtk; selama
  reload `!ready` semua tombol nonaktif — itu perilaku lama, bukan M20).
  Entri mine yang dibuka tetap mengaktifkan Simpan (isinya beda dari template
  asli) — didokumentasikan, bukan bug.
- **File diubah:** `components/Studio.tsx:2031-2034`.

### Klik tombol disabled tanpa umpan balik (L3/M4)
- **Sebelum:** klik `#apply`/`#reset` disabled → toast tidak muncul. Probe event:
  `btn:pointerdown` + `parent:pointerdown:btn` SAMPAI (tidak ada click/mousedown/
  doc-click).
- **Sesudah:** `onPointerDown` di `<aside>` inspector menangkap `pointerdown`
  pada tombol disabled dan memberi toast alasan per tombol. Terukur (klik mouse
  asli): Terapkan → "Tidak ada perubahan untuk diterapkan"; Kembalikan →
  "Belum ada perubahan — tidak ada yang dikembalikan"; Simpan → "Belum ada
  perubahan — edit dulu, baru simpan". Varian lain: "Preview belum siap — tunggu
  sebentar" / "Masih ada N error validasi — perbaiki dulu".
- **File diubah:** `components/Studio.tsx:2039-2062` (`onDisabledPointerDown`;
  didefinisikan sesudah memo `hasAnyEdit` karena TS error used-before-declaration
  bila di dekat `closeSheet`), `:3594` (`onPointerDown` di `<aside>`).

### `<title>` file ekspor masih judul lama (M5)
- **Sebelum (via CLI):** `apply-edit.mjs --edit {"title":"Judul Baru G11B"}` →
  `<title>Claude vs Codex — Adu Kode</title>` tetap.
- **Sesudah:** output `<title>Judul Baru G11B</title>`. Bila `spec.title` tidak
  kosong, `<title>…</title>` diganti judul baru (di-escape, whitespace diringkas).
  Terverifikasi via CLI sebelum rebuild (jalur yang sama dipakai unduhan UI —
  `applyEdits` lib+mjs identik, sync-check hijau).
- **File diubah:** `lib/studio.ts:4930-4933`, `scripts/apply-edit.mjs:4459-4461`.

### Daftar "Video Buatan Saya" berkedip kosong 300–700ms sesudah reload (H3)
- **Tidak terreproduksi di headless** (poll pertama ~100ms sesudah
  `domcontentloaded` sudah badge 1, items 1).
- **Tetap diperbaiki, low-risk:** render `mine-sec` di-gate pada `restored`
  (jalur kode nyata: `mine` mulai `[]`, diisi di efek restore).
- **File diubah:** `components/Studio.tsx:3290` (`{restored && (<div
  className="mine-sec">…`).

### localStorage rusak ditoleransi diam-diam (H5)
- **Sebelum:** set `ss.edits.v1="{rusak"`, `ss.mine.v1="[rusak"`, reload → tidak ada
  toast/pesan.
- **Sesudah:** toast error awam (merah): "Simpanan lama rusak dan tidak bisa
  dibaca — mulai dari tampilan asli." Kunci rusak dihapus (sesudah reload:
  `ss.edits.v1 = "{}"` — ditulis ulang efek persist; `ss.mine.v1 = null`) supaya
  pesan tidak muncul tiap reload. Selaras dengan G5 (toast error awam).
- **File diubah:** `components/Studio.tsx:1786` (efek restore menandai `bad`,
  menghapus kunci rusak, `setTimeout(() => toast(…, true), 0)`).

### Ctrl+K tidak menutup palet (N5) — SUDAH HILANG di G8
Palet terbuka → Ctrl+K lagi → tertutup (`dialog.cmd.cmd-in input` hilang).
Verifikasi sesudah: `n5_open true` → `n5_after_toggle false`. Tidak dikerjakan ulang.

### Backdrop palet tak punya piksel klik (N6) — SUDAH HILANG di G8
`elementFromPoint` di cincin (left+4, top+4) = dialog itu sendiri; klik mouse asli
menutup palet. Verifikasi sesudah: `n6_after_ring_click false` (input palet
hilang). Tidak dikerjakan ulang.

### FAB menutupi sudut frame saat fokus portrait (V1366-11)
- **Sebelum:** 768×1366 fokus: FAB terlihat, overlap dengan stage **3001px²**
  (FAB 670..752 × 1266..1322; stage 40..729 × 93..1317).
- **Sesudah (keputusan: sembunyikan FAB selama fokus):** `display: none`,
  `rectW/H 0`, `visible: false` saat fokus; keluar fokus FAB kembali (sheet tetap
  closed, FAB hanya render saat closed).
- **Perjalanan:** perbaikan pertama (`globals.css` awal, `.app.focus-view
  .sheet-fab`) TIDAK bekerja — selektor 3 kelas kalah dari
  `.app.sheet-mode .sheet-fab` (3 kelas, lebih bawah di file). Diperbaiki dengan
  selektor 4 kelas, rebuild + restart server + verifikasi ulang → hijau.
- Screenshot: `fix-audit500-g11b-m11m20-after-m20-fab-focus.png`
- **File diubah:** `app/globals.css:483` (`.app.focus-view.sheet-mode
  .sheet-fab{display:none}`).

### Keluar fokus membuka lipatan timeline karena `tlManual` di-reset (V1366-12)
- **Sebelum:** dari kondisi TERLIPAT — sheet peek + timeline terlipat → masuk fokus
  → keluar fokus → `collapsed: false`, sheet tetap closed. Akar: tombol fokus
  memanggil `closeSheet()` dan tidak ada yang mengembalikan snap.
- **Sesudah:** keluar fokus → sheet **peek**, `collapsed: true` (lipatan kembali).
  (`focusPrevSnapRef` menyimpan `sheetSnapRef.current` SEBELUM `closeSheet()`;
  efek saat `focusView` false mengembalikan snap bila bukan "closed". Menyimpan di
  efek sudah terlambat karena `sheetSnapRef` disinkronkan saat render.)
- Catatan probe: verifikasi pertama tidak meyakinkan karena precondisi salah
  (sheet sudah closed dari tes FAB sebelumnya, jadi `collapsed: false` di awal
  adalah benar, bukan bug). Verifikasi ulang dengan precondisi benar (peek +
  terlipat) → hijau.
- **File diubah:** `components/Studio.tsx:988` (ref), `:3328` (onClick tombol
  fokus), `:1342-1343` (efek restore).

### Toast tampil di atas strip Peek (V1366-13)
- **Sebelum:** 768×1366 sheet peek: toast "Tema terang" 1301..1332 vs sheet top
  1190 → overlap **2923px²**. (Probe pertama yang menunjukkan overlap 0 adalah
  artefak — sheet sedang closed.)
- **Sesudah:** di mode sheet, toast pindah ke atas (di bawah topbar): `toastTop 60`,
  `sheetTop 1190` (peek, kondisi nyata), **overlap 0**.
- Screenshot: `fix-audit500-g11b-m11m20-after-m20-toast-peek.png`
- **File diubah:** `app/globals.css:816` (`.app.sheet-mode .toast{top:calc(
  var(--topbar-h) + 12px);bottom:auto}`).

### Stage 1920 hanya 17% lebar layar, ±501px kosong tiap sisi (m3) — DITERIMA, tanpa perubahan kode
Geometri terkonfirmasi: stage 327×581 (17% lebar 1920), `viewerBodyH 625` vs
`stageH 581` — stage sudah 93% tinggi viewer-body (dibatasi padding `fitStage`:
`availH = height − 2×22px`). Ini geometri 9:16 yang tak terhindarkan; mode fokus
adalah jalan memperbesar. Tidak ada perubahan kode.

### Nama kartu galeri terpotong (F9)
- **Sebelum:** "Mengetik (Claude × Rehan) — video percobaan yang sangat panjang
  namanya": `scrollW 427 vs clientW 76`, `<b>` tanpa atribut `title` (tooltip
  lengkap hanya ada di tombol induk).
- **Sesudah:** `<b title={m.label}>` — nama tetap ellipsis (CSS sudah ada),
  tooltip nama lengkap muncul. Terukur: `truncated: true`,
  `titleAttr` = label lengkap.
- **File diubah:** `components/Studio.tsx:3304`.

### `mug.gap` 0.48 di luar langkah slider 0.05 (N10)
- **Sebelum:** slider Rapat: value `0.5` (terjepit ke grid 0.05), step 0.05,
  tampilan teks "0.48".
- **Sesudah (keputusan: ubah step jadi 0.01, nilai bawaan 0.48 dipertahankan):**
  `value 0.48`, `step 0.01`, tampil `0.48`.
- **File diubah:** `lib/studio.ts:2750-2758` (def `mug.gap` step `0.05` → `0.01`),
  `scripts/apply-edit.mjs:2398-2406` (cermin).

### Drag gagang naik malah turun (V1366-06) — TIDAK TERREPRODUKSI
Probe forensik bersih (`~/workspace/g11b/probe5.mjs` + verifikasi sesudah):
drag naik 200px dari peek → half; drag naik lagi → full; arah benar;
`pointerdown/move/up` sampai ke handler. Probe drag awal yang gagal adalah artefak
( rect gagang dibaca saat sheet masih closed/transisi). Diduga artefak headless
seperti audit — **tanpa perubahan kode**.

---

## Ringkasan status per item

| Item | Status |
|---|---|
| M11 Tidur hint | Sudah hilang (G11a) |
| M11 Rapat / Deploy | Diperbaiki ✓ |
| M12 | Diperbaiki ✓ |
| M13 | Diperbaiki ✓ |
| M14 | Sudah hilang (G3) — dibuktikan ulang |
| M15 | Diperbaiki ✓ |
| M16 | Diperbaiki ✓ (ruang kosong 731px → 8px) |
| M17 | Diperbaiki ✓ (kontras 1.14:1 → 13.8:1) |
| M18 | Diperbaiki ✓ (satu baris, slack 6–8px) |
| M19 (a)(b)(c) | Diperbaiki ✓ (sisa 1px di (b) = lebar tick sendiri) |
| M20 Half | Diperbaiki ✓ |
| M20 tema HP | Diperbaiki ✓ (themeBtn kembali, keysBtn tetap di palet) |
| M20 Simpan semua tab | Diperbaiki ✓ |
| M20 Simpan tanpa edit | Diperbaiki ✓ |
| M20 klik disabled | Diperbaiki ✓ |
| M20 `<title>` | Diperbaiki ✓ |
| M20 mine berkedip | Tidak terreproduksi; tetap diperbaiki (gate `restored`) |
| M20 LS rusak | Diperbaiki ✓ |
| M20 N5 / N6 | Sudah hilang (G8) |
| M20 FAB fokus | Diperbaiki ✓ (butuh 2 iterasi — spesifisitas CSS) |
| M20 lipatan fokus | Diperbaiki ✓ |
| M20 toast/Peek | Diperbaiki ✓ |
| M20 stage 1920 | Diterima (geometri 9:16), tanpa perubahan |
| M20 galeri F9 | Diperbaiki ✓ |
| M20 mug.gap | Diperbaiki ✓ |
| M20 drag V1366-06 | Tidak terreproduksi, tanpa perubahan |

## Yang TIDAK berhasil / tidak dilakukan
- Tidak ada item yang gagal diperbaiki. Dua hal yang butuh iterasi kedua sudah
  hijau sesudahnya: (1) FAB — selektor CSS pertama kalah spesifisitas;
  (2) alur regresi Simpan — probe pertama mengklik 1,2 dtk sesudah Terapkan saat
  preview masih reload (`!ready`); sesudah menunggu `ready`, alur hijau penuh.
  Keduanya adalah artefak probe/perbaikan, bukan cacat produk yang tersisa.
- M15: selisih 8px (Ekspor top=24 vs Pintasan/palet top=16) tidak dijelaskan —
  tidak berbahaya, semua dialog bermargin ≥16px dan muat di viewport kecil.
- M19(b): sisa overflow 1px (tick terakhir 1px di 100%) — dapat diabaikan.
