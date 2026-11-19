# Perbaikan G8 — U12/U13: Dialog bertumpuk + Esc + pintasan (N5/N6/V16)

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U12 (N4, terverifikasi ulang B6), U13 (V6/X2/F3/M3 + L4/N7, terverifikasi ulang B9); terkait N5, N6, V16
- **Status: SELESAI — U12 + U13 hilang; N5, N6, V16 hilang.** Reproduksi di main saat ini membuktikan semua sub-masalah MASIH ADA (bukan "sudah hilang"); sesudah perbaikan, Esc menutup tiap dialog satu-per-satu secara LIFO, 3 lapis tertutup berurutan, Ctrl+K hidup saat dialog terbuka dan menutup palet, backdrop palet bisa diklik, dan drawer menutup via Esc di semua lebar.
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi). Catatan: folder lokal ini **tidak punya `.git`** (bukan checkout git), jadi verifikasi "main `3a893fae`" tidak bisa dikonfirmasi dari sini — yang diverifikasi adalah isi kode di disk saat kerja dimulai (sama seperti catatan G7).

## 1. Reproduksi — SEBELUM perbaikan: semua sub-masalah ADA, persis seperti audit

Server prod port 3318 (`npm run build` + `npm start -- --port 3318`), Playwright + `chrome-headless-shell`, viewport 1440×900 (drawer juga 1024×768), profil browser baru per skenario (localStorage segar, tur dimatikan via `ss.tour=1` kecuali uji tur). 0 `pageerror` / console error di semua run. Bukti angka: `~/workspace/g8-u12u13/repro-before.json`, `repro-drawer.json`, `repro-drawer2.json`.

### (a) U13 — Esc tidak menutup dialog (Simpan / Ekspor / Pintasan)

| Dialog | SEBELUM |
|---|---|
| Simpan (fokus di input nama) | Esc#1 hanya **blur** input (fokus INPUT → BODY); Esc#2 tidak berbuat apa-apa; dialog tetap `open` |
| Ekspor | Esc tidak berbuat apa-apa; dialog tetap `open` |
| Pintasan (`?`) | Esc tidak berbuat apa-apa; dialog tetap `open` |
| Screenshot | `fix-audit500-g8-u12u13-before-a1-simpan-esc.png`, `before-a2-ekspor-esc.png`, `before-a3-pintasan-esc.png` |

### (b) U13 bonus — Ekspor mematikan SEMUA pintasan diam-diam

Ekspor terbuka → **Ctrl+K tidak membuka palet** (palet tetap tertutup). Penyebab kode: `if (cmdOpen || expOpen || keysOpen) return;` di handler `keydown` window (`Studio.tsx:2474` sebelum perbaikan; nomor audit `2256` sudah bergeser karena G1–G7).

### (c) U12 — Dialog bertumpuk 3 lapis

Ekspor (`E`) → palet (tombol `#cmdBtn`, karena Ctrl+K mati) → Simpan (tombol inspector di balik palet):

| Ukur | SEBELUM |
|---|---|
| Ketiga lapis `open` | ya — Ekspor + palet + Simpan |
| `elementFromPoint` di tengah dialog Simpan | `button.cmd-i` (palet) — **bukan dialog itu sendiri** |
| `elementFromPoint` di tengah dialog Ekspor | `span.l` (palet) — **bukan dialog itu sendiri** |
| z-index ketiganya | **80 / 80 / 80** (DOM order menang → palet terakhir = paling atas) |
| Esc ×4 | **tidak ada yang tertutup** (Esc#1 hanya blur input Simpan; Esc#2–4 diam); ✕ dialog yang tertutup palet tak bisa diklik |
| Screenshot | `fix-audit500-g8-u12u13-before-b-3lapis.png`, `before-b-esc4.png` |

**Temuan baru saat repro (di luar audit, satu akar):** sesudah 3 lapis dibersihkan via ✕ (JS), palet yang tersisa **tidak bisa ditutup Esc sama sekali** bila fokus sudah di BODY — handler Esc palet hanya ada di `onKeyDown` input-nya sendiri, sedangkan handler window return dini bila `cmdOpen`. Jadi klaim audit "palet justru menutup via Esc" hanya benar bila fokus masih di dalam input palet; begitu fokus keluar, palet macet total (ini yang membuat Esc×4 di (c) mati: Esc#1 mem-blur input Simpan → fokus BODY → Esc berikutnya dicegat return-dini).

### (d) N5 — Ctrl+K tidak menutup palet yang sedang terbuka

Palet terbuka → Ctrl+K lagi → palet **tetap terbuka** (juga Esc dari fokus BODY tidak menutupnya — lihat (c)). Dua penyebab: return-dini `cmdOpen` di handler window + cabang `typing` yang mengembalikan lebih dulu saat mengetik di input palet.

### (e) N6 — Backdrop palet tak punya piksel klik

`dialog.cmd` rect 440,0 560×455, `padding: 0`; ketiga anak (`.cmd-in` 44px + `.cmd-list` 380px + `.cmd-foot` 28,5px) mengisinya penuh persis. Sampling grid 16px di dalam rect: **`elementFromPoint === dialog` di 0 dari 1015 titik** — handler `onClick` (`e.target === e.currentTarget`) adalah dead code dalam praktik. Terkonfirmasi persis seperti audit.

### (f) V16 — Drawer tidak menutup via Esc

| Varian | SEBELUM |
|---|---|
| 1024×768, fokus BODY | Esc **menutup** drawer (cabang `<= 1180` bekerja) — V16 tidak tereproduksi di varian ini |
| 1024×768, fokus di input pencarian drawer, query `"kuota"` | Esc#1 hanya **mengosongkan query + blur** (handler `onKeyDown` input sendiri); drawer tetap terbuka; baru Esc#2 menutupnya |
| 1440×900 (drawer docked, default terbuka) | Esc **tidak pernah** menutup drawer — gate `window.innerWidth <= 1180` |
| Screenshot | `fix-audit500-g8-u12u13-before-drawer-1024-esc.png`, `before-drawer-1024-input-esc.png` |

## 2. Akar

Semua di `components/Studio.tsx` + satu baris `app/globals.css`:

1. **Satu `return` dini membunuh semua keyboard:** `if (cmdOpen || expOpen || keysOpen) return;` — begitu satu lapis terbuka, handler window berhenti; Ctrl+K, Esc, dan semua pintasan mati. `saveMineOpen` bahkan tidak ada di daftar itu (inkonsisten).
2. **Esc tidak punya cabang dialog:** satu-satunya cabang Esc di ujung handler hanya menutup sheet → fokus viewer → drawer (dengan gate lebar). Cabang `typing` di atasnya mengubah Esc jadi sekadar `blur()` saat fokus di input.
3. **Esc palet hanya hidup di input-nya sendiri** (`onKeyDown` input palet) — begitu fokus keluar dari input, tidak ada jalur Esc untuk palet.
4. **z-order = DOM order:** keempat `<dialog open>` non-modal berbagi `z-index: 80` (`globals.css:628`); `.cmd` dirender sesudah ketiga `<dialog>` sehingga palet selalu paling atas, apa pun urutan bukanya.
5. **N6:** `dialog{padding:0}` + anak-anak palet mengisi penuh → tidak ada piksel backdrop.
6. **V16:** gate lebar `<= 1180` + handler Esc input pencarian drawer yang menelan Esc pertama (bersihkan + blur, tanpa menutup drawer).

## 3. Perbaikan (kode studio saja — 2 file)

### Keputusan z-order (U12) — DIDOKUMENTASIKAN

**Dipilih: tumpukan dinamis menurut urutan DIBUKA (LIFO), bukan "tutup palet saat dialog dibuka" dan bukan prioritas tetap.** Alasan:

- Menutup palet saat dialog dibuka merusak alur yang sah (mis. Ekspor terbuka → Ctrl+K → palet harus tampil DI ATAS Ekspor; kalau dialog selalu di atas palet, palet yang dibuka belakangan jadi tak terlihat — cacat yang sama, terbalik).
- Prioritas tetap (mis. Simpan > palet > Ekspor) salah untuk urutan buka lain (mis. Simpan dulu lalu palet — palet harus di atas karena dibuka belakangan).
- Tumpukan urutan-buka menangani semua urutan secara simetris; Esc menutup persis kebalikan urutan buka; z-index = 80 + posisi di tumpukan (maks 83, tetap di bawah tur 100 dan toast 120).

### a) Tumpukan lapis + `closeTopLayer` — `components/Studio.tsx:624–657`

- `layerStackRef` + state `layerStack`: satu efek sinkronisasi dari keempat boolean (`expOpen`, `saveMineOpen`, `keysOpen`, `cmdOpen`) — urutan lama dipertahankan, yang baru dibuka ditambahkan di akhir. Satu efek, bukan di tiap situs pemanggil, supaya urutan buka yang sebenarnya selalu terjaga.
- `closeTopLayer()`: menutup lapis teratas, `false` bila tidak ada lapis terbuka.

### b) Handler keyboard direstrukturisasi — `components/Studio.tsx:2502–2535` + deps `:2593`

Urutan baru di `onKey` (tur tetap didahulukan, tidak diubah):

1. **Ctrl/⌘+K selalu toggle palet** — dicek SEBELUM cabang `typing` dan sebelum apa pun: hidup saat mengetik di input, saat dialog terbuka, dan menutup palet yang sedang terbuka (N5 + bonus U13). `return` dini `cmdOpen || expOpen || keysOpen` **dihapus**.
2. **Esc menutup SATU lapis teratas dulu (LIFO)** — dicek sebelum cabang `typing`: `closeTopLayer()` → bila fokus di input pencarian drawer dan ada query, bersihkan dulu + blur (perilaku lama dipertahankan, lihat §3e) → bila sedang mengetik di input lain, blur (perilaku lama) → sheet → fokus viewer → **drawer (tanpa gate lebar)**.
3. `typing` → return (huruf tidak memicu pintasan saat mengetik — tidak diubah).
4. Pintasan lain (Space/K, panah, `[`/`]`, `,`,`.`, M/L/G/F, E, T, R, `?`, `/`, D, Ctrl+Enter) — **semuanya tetap hidup saat dialog terbuka**; tidak ada yang dimatikan diam-diam. Cabang Esc lama di ujung handler (sheet/fokus/drawer + gate `<= 1180`) dihapus karena sudah ditangani di atas.
5. Deps efek diperbarui: `cmdOpen/expOpen/keysOpen` keluar (tidak lagi dibaca), `q` + `closeTopLayer` masuk.

### c) z-index dinamis di keempat dialog — `Studio.tsx:3460, 3494, 3517, 3546`

`style={{ zIndex: 80 + Math.max(0, layerStack.indexOf("exp"|"save"|"keys"|"cmd")) }}` — 80 = dasar CSS, +0..3 menurut posisi di tumpukan.

### d) Handler Esc di level input dihapus (satu jalur Esc global) — `Studio.tsx`

- Input palet: cabang `else if (e.key === "Escape") setCmdOpen(false)` dihapus — Esc kini ditangani handler window (LIFO). Menghapus ini juga menghilangkan risiko tutup-ganda.
- Input pencarian drawer: cabang Esc (bersihkan + blur) dihapus — perilakunya pindah ke handler window (Esc#1 bersihkan bila ada query, Esc#2 tutup drawer); cabang Enter dipertahankan.

### e) N6 — padding palet — `app/globals.css:401–405`

`.cmd{...;padding:10px}` (+ komentar). Cincin 10px warna `--panel` (sama dengan dialog) di sekeliling konten adalah area klik yang menutup palet; `box-sizing:border-box` menjaga ukuran luar (560px). Dipilih memberi padding (bukan menghapus handler mati) karena handler `onClick` yang sudah ada menjadi hidup tanpa mengubah DOM.

### Keputusan yang sengaja TIDAK diambil

- **`.dlg` (Ekspor/Simpan/Pintasan) tidak diberi padding.** Pengukuran sesudah perbaikan: sampling grid 12px di dialog Ekspor → `elementFromPoint === dialog` hanya **1 dari 1014 titik** (piksel border) — handler backdrop `.dlg` juga praktis dead code, kelas masalah yang sama dengan N6. Sengaja tidak diperbaiki: di luar scope audit (N6 hanya soal palet), dan mengubah tampilan ketiga dialog; ketiganya tetap bisa ditutup via ✕, tombol, dan kini Esc. Dicatat sebagai batasan (§7).
- **Esc#1 di input pencarian drawer tetap "bersihkan query", bukan langsung tutup drawer.** Membersihkan pencarian adalah aksi in-place yang sudah ada; menutup drawer langsung akan membunuh fitur itu. Urutannya kini eksplisit dan konsisten di semua lebar: Esc#1 bersihkan (bila ada teks) → Esc#2 tutup drawer. Berbeda dengan input dialog (Esc#1 langsung tutup dialog) karena dialog adalah lapis modal yang Esc-nya berarti "tutup lapis ini".

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 Esc tiap dialog (U13)

| Dialog | SESUDAH |
|---|---|
| Simpan (fokus di input nama) | **Esc#1 langsung menutup dialog** (bukan cuma blur) |
| Ekspor | **Esc menutup** |
| Pintasan | **Esc menutup** |
| Screenshot | `fix-audit500-g8-u12u13-after-a1-simpan-esc.png`, `after-a2-ekspor-esc.png`, `after-a3-pintasan-esc.png` |

### 4.2 Tiga lapis LIFO (U12) — urutan buka Ekspor → palet → Simpan

| Langkah | SESUDAH |
|---|---|
| 3 lapis terbuka | z-index **Ekspor 80, palet 81, Simpan 82** — Simpan (terakhir dibuka) paling atas |
| `elementFromPoint` tengah Simpan | `div.dlg-b` (dialog itu sendiri — bukan lagi palet) |
| `elementFromPoint` tengah Ekspor | `p.note` (konten dialog itu sendiri — bukan lagi palet) |
| Esc#1 | **Simpan tutup** → palet kini teratas (tengah Ekspor = `span.l` palet — benar, palet memang lapis teratas saat itu) |
| Esc#2 | **Palet tutup** → Ekspor kini teratas (tengah Ekspor = `p.note` miliknya) |
| Esc#3 | **Ekspor tutup** — semua lapis tertutup |
| Esc#4 | Drawer (docked, 1440) ikut tertutup — konsekuensi V16 (§4.5) |
| Screenshot | `fix-audit500-g8-u12u13-after-b-3lapis.png` (Simpan penuh terlihat di atas palet; palet tampak di belakangnya), `after-b-esc3.png` |

### 4.3 Ctrl+K saat dialog terbuka + toggle palet (U13 bonus + N5)

| Langkah | SESUDAH |
|---|---|
| Ekspor terbuka → Ctrl+K | **Palet terbuka DI ATAS Ekspor** (z 81 > 80), fokus di input palet |
| Esc | Palet tutup, Ekspor tetap → Esc lagi: Ekspor tutup |
| Palet dibuka segar via Ctrl+K (fokus di input) → Ctrl+K lagi | **Palet tertutup** |
| Palet dibuka via tombol lalu fokus di-blur ke BODY (kasus macet di repro §1c) → Esc | **Palet tertutup** (dulu: macet total) |

### 4.4 Backdrop palet (N6)

| Ukur | SESUDAH |
|---|---|
| `padding` dialog `.cmd` | `10px` (dulu `0px`); rect 560×474,5 (konten 538 lebar) |
| Sampling grid: `elementFromPoint === dialog` | **98 dari 1050 titik** (dulu 0/1015) |
| Klik cincin padding (5px dari tepi dialog) | **Palet tertutup** |
| Screenshot | `fix-audit500-g8-u12u13-after-d-palet-backdrop.png` (cincin bingkai tampak di sekeliling palet) |

### 4.5 Drawer Esc (V16)

| Varian | SESUDAH |
|---|---|
| 1024×768, fokus BODY → Esc | Drawer **tertutup** (tetap) |
| 1024×768, input pencarian query `"kuota"` → Esc#1 | Query **dikosongkan + blur**, drawer tetap terbuka (perilaku lama, kini disengaja) |
| → Esc#2 | Drawer **tertutup** |
| 1440×900 (drawer docked) → Esc | Drawer **tertutup** (gate `<= 1180` dicabut) |
| 1440 → `T` | Drawer terbuka lagi (toggle tetap jalan) |
| Screenshot | `fix-audit500-g8-u12u13-after-drawer-1024-esc.png`, `after-drawer-1440-esc.png` |

### 4.6 Pintasan lain tetap hidup saat dialog terbuka

Ekspor terbuka → `T` membalik drawer (tertutup → terbuka); `?` membuka dialog Pintasan **di atas** Ekspor (z 81 > 80); Esc menutup Pintasan → Esc menutup Ekspor. Tidak ada pintasan yang dimatikan diam-diam; tidak ada petunjuk UI tambahan yang diperlukan karena tidak ada yang dimatikan.

### 4.7 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih (exit 0).
- `npm run build`: hijau (`✓ Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak menyentuh `lib/`/CLI; dijalankan sebagai jaring pengaman.)
- 0 `pageerror` / console error di semua run verifikasi (`verify-after.json`, `verify-drawer-after.json`, `regression-after.json`, `regression-tour.json`).

## 5. Regresi — G1–G7 tidak rusak + tur

Bukti: `~/workspace/g8-u12u13/regression-after.json`, `regression-tour.json`.

- **Fresh load 12/12**: semua `ready=true`, bridge OK, **`0 error validasi bawaan`** (`.valid-err` = 0 di semua template).
- **Alur edit → Terapkan → Simpan → reload** (Bom + Versus): ketik judul → Terapkan → toast "Semua edit diterapkan" → Simpan sebagai video baru → dialog terbuka → **✕ menutup dialog** → buka lagi → "Simpan video" → 1 entri `ss.mine.v1` → reload → judul + entri bertahan (Bom: "G8 U12 FLOW BOMB"; Versus: "G8 U12 FLOW VERSUS"). 0 error.
- **Tur:** kunjungan pertama (tanpa `ss.tour`) → kartu tur muncul "Langkah 1 dari 5" → **Esc mengakhiri tur** (kartu hilang, `ss.tour=1`). Esc di tur tetap mengakhiri tur seperti sebelumnya. Screenshot: `fix-audit500-g8-u12u13-after-tour-muncul.png`, `after-tour-esc.png`.

## 6. Catatan pengujian (artefak skrip, bukan cacat produk)

1. **Klik pertama "Simpan sebagai video baru" di skrip regresi sempat gagal** (`save_open: false` di run pertama): tombol itu `disabled={!ready}` — sesudah Terapkan, preview dimuat ulang dan tombol disabled sampai bridge siap lagi (~>600ms); `el.click()` pada tombol disabled adalah no-op. Bukan cacat perbaikan: skrip diperbaiki menunggu tombol aktif (poll ≤15 dtk) lalu kedua alur hijau penuh (`save_click1/2: true`). Di pemakaian nyata tombol yang disabled memang tidak bisa diklik.
2. **Run pertama regresi tur membaca kartu `false`:** kartu tur muncul ~1–1,5 dtk sesudah "Preview siap" (pengukuran posisi tur lambat di SwiftShader); pembacaan di +2,5 dtk tetap kalah cepat di run itu — tapi `ss.tour` sudah `1` sesudah Esc, bukti `endTour` jalan (hanya terpanggil bila tur aktif). Diulang dengan `waitForFunction` kartu (timeout 15 dtk): kartu muncul → Esc menutupnya. Bukti akhir di `regression-tour.json`.
3. **Restart service di tengah kerja** mematikan server tes port 3318 (dan server chat lain port 3100 — bukan oleh saya; saya hanya pernah `kill` PID server 3318 saya sendiri). Server 3318 di-start ulang dari build yang sama (BUILD_ID `7MH_S1g916A4oIHb-jB03200`); probe yang terpotong (`probe-dlg-backdrop`) diulang sesudah restart.

## 7. Yang TIDAK berhasil / batasan (dengan bukti)

1. **Handler backdrop `.dlg` (Ekspor/Simpan/Pintasan) tetap praktis dead code** — sampling grid 12px di dialog Ekspor: `elementFromPoint === dialog` hanya **1 dari 1014 titik** (piksel border 1px). Sengaja tidak diperbaiki: di luar scope (N6 hanya palet) dan mengubah tampilan ketiga dialog. Ketiganya tetap tertutup via ✕, tombol Batal/Simpan, klik backdrop tidak dimungkinkan — dan kini via Esc.
2. **Esc#1 di input pencarian drawer tidak langsung menutup drawer** bila ada teks query — sengaja (membersihkan pencarian dipertahankan, §3e); Esc#2 menutupnya.
3. **Esc saat tidak ada lapis/dialog/sheet/fokus-viewer kini menutup drawer di SEMUA lebar**, termasuk drawer docked di desktop 1440 (dulu hanya ≤1180). Ini yang diminta V16; konsekuensinya Esc "kosong" pertama di desktop menutup panel Project (bisa dibuka lagi via `T` / hamburger). Dicatat supaya koordinator sadar akan perubahan perilaku ini.
4. **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900 + 1024×768, server port 3318 (dimatikan sesudah verifikasi).

## 8. File yang diubah + bukti

**Diubah (2 file, kode studio saja):**
- `components/Studio.tsx` — tumpukan lapis + `closeTopLayer` (`:624–657`); handler keyboard: Ctrl+K selalu toggle + Esc LIFO + hapus return-dini + hapus cabang Esc lama & gate lebar (`:2502–2535`, deps `:2593`); z-index dinamis keempat dialog (`:3460` Ekspor, `:3494` Simpan, `:3517` Pintasan, `:3546` palet); hapus handler Esc input palet (`:3560` sekitar) dan input pencarian drawer (`:2700` sekitar).
- `app/globals.css` — `.cmd` padding 10px (`:401–405`).

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); `lib/studio.ts`, `scripts/`; file audit (`verification/audit-500-2026-11-18.md`, mtime 2026-11-19 05:02); file bukti G1–G7 (mtime terbaru tetap 2026-11-19 09:38, sebelum kerja G8).

**Bukti baru (`verification/`, 17 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g8-u12u13.md`
- Sebelum: `fix-audit500-g8-u12u13-before-a1-simpan-esc.png`, `before-a2-ekspor-esc.png`, `before-a3-pintasan-esc.png`, `before-b-3lapis.png`, `before-b-esc4.png`, `before-drawer-1024-esc.png`, `before-drawer-1024-input-esc.png`
- Sesudah: `fix-audit500-g8-u12u13-after-a1-simpan-esc.png`, `after-a2-ekspor-esc.png`, `after-a3-pintasan-esc.png`, `after-b-3lapis.png`, `after-b-esc3.png`, `after-d-palet-backdrop.png`, `after-drawer-1024-esc.png`, `after-drawer-1440-esc.png`, `after-tour-muncul.png`, `after-tour-esc.png`

**Skrip kerja (di luar repo, persisten):** `~/workspace/g8-u12u13/h.mjs` (harness), `repro-before.mjs` (`repro-before.json`), `repro-drawer.mjs` (`repro-drawer.json`), `repro-drawer2.mjs` (`repro-drawer2.json`), `verify-after.mjs` (`verify-after.json`), `verify-drawer-after.mjs` (`verify-drawer-after.json`), `regression-after.mjs` (`regression-after.json`), `regression-tour.mjs` (`regression-tour.json`), `probe-focus.mjs`, `probe-savebtn.mjs`, `probe-tour.mjs`, `probe-tour2.mjs`, `probe-dlg-backdrop.mjs`.
