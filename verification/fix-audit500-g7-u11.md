# Perbaikan G7 — U11: Hash navigation + Back rusak

- **Tanggal:** 2026-11-19 (WIB)
- **Acuan:** `verification/audit-500-2026-11-18.md` — U11 (N1/N2/N3, temuan Nav; terverifikasi ulang B5)
- **Status: SELESAI — U11 hilang.** Reproduksi di main saat ini membuktikan ketiga sub-masalah MASIH ADA (bukan "sudah hilang"); sesudah perbaikan, hash manual mengganti template, hash tidak dikenal menampilkan pesan + hash diperbaiki, dan Back/Forward antar template in-app berfungsi 2 langkah maju-mundur.
- **Tidak ada push / branch / merge** (koordinator yang push sesudah verifikasi). Catatan: folder lokal ini **tidak punya `.git`** (bukan checkout git), jadi verifikasi "main `3bfec0ec`" tidak bisa dikonfirmasi dari sini — yang diverifikasi adalah isi kode di disk saat kerja dimulai.

## 1. Reproduksi — SEBELUM perbaikan: ketiga sub-masalah ADA, persis seperti audit

Server prod port 3317 (`npm run build` + `npm start -- --port 3317`), Playwright + `chrome-headless-shell`, viewport 1440×900, profil browser baru per skenario (localStorage segar). 0 `pageerror` / console error di semua run.

### (a) Hash manual diabaikan (N1)

| Langkah | SEBELUM |
|---|---|
| Load `/#template-code` | "Adu Kode" (`template-code.html`), hash `#template-code`, `histLen=2` |
| `location.hash = "#template-trio"` | URL jadi `/#template-trio`, **`histLen=3`** — tapi template **tetap "Adu Kode"** (`template-code.html`), toast kosong |
| Screenshot | `fix-audit500-g7-u11-before-a-hash-manual.png` |

### (b) Hash tidak dikenal ditelan diam-diam (N2)

| Langkah | SEBELUM |
|---|---|
| Load `/#template-tidakada` | "Perang Sub Agent" (`template-perang.html`, TEMPLATES[0]), hash **tetap `#template-tidakada`**, toast **kosong** (juga sesudah +1,5 dtk) |
| Screenshot | `fix-audit500-g7-u11-before-b-hash-tidakada.png` |

### (c) Back sesudah ganti template in-app keluar ke `about:blank` (N3)

| Langkah | SEBELUM |
|---|---|
| Load `/#template-code` → klik Trio di drawer | "Claude vs Codex vs Gemini", hash `#template-trio`, `histLen` **tetap 2** (`replaceState`, tidak ada entri baru) |
| Back | **`about:blank`** (label/file `null`, halaman kosong — screenshot 5.851 byte) |
| Forward | kembali ke `#template-trio` ("Claude vs Codex vs Gemini") |
| Screenshot | `fix-audit500-g7-u11-before-c-sesudah-trio.png`, `before-c-back.png` (blank), `before-c-forward.png` |

Bukti angka: `~/workspace/g7-u11/repro-before.json`.

## 2. Akar

Semua di `components/Studio.tsx`, satu-satunya tempat hash disentuh:

1. `openTemplate` (`:1363` sebelum) selalu `history.replaceState` — ganti template in-app tidak pernah menambah entri riwayat.
2. Hash hanya dibaca sekali di efek init (`:1396` sebelum) — tidak ada `hashchange` listener di mana pun (grep `hashchange`/`popstate`: 0 hit sebelum perbaikan).
3. Init memakai `TEMPLATES.find(...) || TEMPLATES[0]` tanpa pesan bila hash tidak cocok.

## 3. Perbaikan (kode studio saja — 1 file)

**`components/Studio.tsx` saja.** `lib/studio.ts`, `scripts/`, `app/`, CSS, dan 12 template asli tidak disentuh.

### a) `openTemplate(t, opts?: { push?: boolean })` — `:1355–1381`

- Ganti template in-app (`opts.push`) memakai **`history.pushState`**; pergantian lewat `hashchange` (Back/Forward/ketik manual) memakai `replaceState` seperti dulu — entrinya sudah ada, jangan digandakan.
- `pushState`/`replaceState` **tidak memicu `hashchange`** — tidak ada loop.
- Draf kotor tetap disimpan dulu via `saveCurrentFullEdit()` seperti sebelumnya (tidak diubah).
- Cermin sinkron `openTemplateRef` (`:1379–1381`, pola ref yang sama seperti `stateRef`/`fullEditsRef`) supaya listener hashchange selalu memanggil versi terbaru tanpa daftar ulang.

### b) Tiga situs pemanggil in-app → `{ push: true }`

- `:1924` `openMine` (Video Buatan Saya), `:2246` palet perintah (Ctrl+K → Template), `:2716` drawer (`#tplList`).

### c) Efek init — hash tidak dikenal diberi pesan + hash diperbaiki — `:1412–1420`

```ts
const rawHash = /* decodeURIComponent hash, aman dari % rusak */;
const found = TEMPLATES.find((t) => slug(t) === want);
if (rawHash && !found) {
  toast("Template itu tidak ditemukan, dibuka template pertama");
  try { history.replaceState(null, "", "#" + slug(first)); } catch { /* file:// */ }
}
```

Hash kosong / `ss.last` usang tetap fallback diam-diam (bukan ketikan pengguna, tidak ada yang perlu dijelaskan). Slug valid saat load awal tetap berfungsi seperti sebelumnya.

### d) Listener `hashchange` baru — `:1430–1455`

- Hash valid → `openTemplate(t)` (tanpa push; no-op bila template sudah yang itu — satu `hashchange` = satu pergantian).
- Hash tidak dikenal → toast yang sama + `replaceState` memperbaiki hash ke `#template-perang` + buka template pertama.
- Hash dikosongkan → biarkan template sekarang (tidak ada temuan audit untuk ini; pilihan aman).
- Cleanup `removeEventListener` saat unmount / `restored` berubah.

## 4. Verifikasi — SESUDAH perbaikan

### 4.1 (a) Hash manual mengganti template

| Langkah | SESUDAH |
|---|---|
| Load `/#template-code` | "Adu Kode", `histLen=2` |
| `location.hash = "#template-trio"` | **"Claude vs Codex vs Gemini"** (`template-trio.html`), hash `#template-trio`, `histLen=3` (delta +1 = entri browser sendiri untuk penetapan hash; handler menambah 0) |
| `location.hash = "#template-code"` | **kembali "Adu Kode"**, `histLen=4` |
| Hash manual ke template yang sedang terbuka (`#template-code` saat Adu Kode) | no-op: label/hash/`histLen` tidak berubah, toast kosong |
| 0 error | |
| Screenshot | `fix-audit500-g7-u11-after-a-hash-manual-trio.png` |

### 4.2 (b) Hash tidak dikenal → pesan + template pertama + hash diperbaiki

| Varian | SESUDAH |
|---|---|
| Load awal `/#template-tidakada` | Toast **"Template itu tidak ditemukan, dibuka template pertama"** (tertangkap polling, tampak di screenshot), template **"Perang Sub Agent"**, hash diperbaiki ke **`#template-perang`**, `histLen=2` |
| Hashchange saat aplikasi terbuka (`#template-code` → `location.hash = "#template-tidakada"`) | Toast yang sama, template **"Perang Sub Agent"**, hash diperbaiki ke **`#template-perang`**, `histLen=3` (delta +1 = entri penetapan hash saja) |
| Screenshot | `fix-audit500-g7-u11-after-b-hash-tidakada.png` (toast tampak di bawah layar), `after-b2-hash-tidakada.png` |

### 4.3 (c) Back/Forward 2 langkah antar template in-app

Urutan: load `#template-code` → drawer Trio → drawer Bomb → Back → Back → Forward → Forward.

| Langkah | SESUDAH (label / hash / histLen) |
|---|---|
| Awal | Adu Kode / `#template-code` / 2 |
| Klik Trio (drawer) | Claude vs Codex vs Gemini / `#template-trio` / **3** (push) |
| Klik Bomb (drawer) | Misi Mustahil: Merge Conflict / `#template-bomb` / **4** (push) |
| Back #1 | **Claude vs Codex vs Gemini** / `#template-trio` / 4 |
| Back #2 | **Adu Kode** / `#template-code` / 4 |
| Forward #1 | **Claude vs Codex vs Gemini** / `#template-trio` / 4 |
| Forward #2 | **Misi Mustahil: Merge Conflict** / `#template-bomb` / 4 |
| `histLen` tidak berubah selama Back/Forward (tidak ada entri ganda) | |
| Screenshot | `after-c-back1-trio.png`, `after-c-back2-code.png`, `after-c-fwd2-bomb.png` |

Run ulangan dengan jeda sampai "Preview siap" di tiap langkah: **setiap langkah mencapai "Preview siap"**, 0 error (`~/workspace/g7-u11/verify-after-c-slow.json`).

### 4.4 Tidak ada loop / pergantian ganda

Satu `location.hash = "#template-trio"`: `histLen` 2 → 3 (delta tepat +1), label stabil "Claude vs Codex vs Gemini" sesudah +3 dtk, `histLen` tetap 3, 0 error. Bukti: `~/workspace/g7-u11/verify-after.json` (§d).

### 4.5 Build + sync-check — HIJAU

- `npx tsc --noEmit`: bersih (exit 0).
- `npm run build`: hijau (`✓ Compiled successfully`, 4/4 static pages).
- `node scripts/sync-check.mjs`: **SEMUA HIJAU — 12/12 template byte-identik lib == mjs**; vendor three.js 12/12 rewrite 13/13 + export tetap CDN. (Tidak menyentuh `lib/`/CLI; dijalankan sebagai jaring pengaman.)

## 5. Regresi — G1–G6 tidak rusak

Bukti: `~/workspace/g7-u11/regression-after.json`.

- **Fresh load 12/12**: semua `ready=true`, bridge `true`, **`0 error validasi bawaan`** (`.valid-err` = 0 di semua template).
- **Alur edit → Terapkan → Simpan → reload** (Bom + Versus): ketik judul → Terapkan → toast "Semua edit diterapkan" → `ss.edits.v1` berisi judul → Simpan sebagai video baru → 1 entri `ss.mine.v1` → reload → judul + entri bertahan (Bom: "G7 U11 FLOW BOMB"; Versus: "G7 U11 FLOW VERSUS"). 0 error.
- **Draf kotor bertahan saat ganti template** (perilaku yang audit nyatakan benar): ketik judul "G7 U11 DRAF KOTOR" di Adu Kode tanpa Terapkan → pindah ke Trio → kembali ke Adu Kode → field judul tetap "G7 U11 DRAF KOTOR", `ss.edits.v1` berisi edit itu. Screenshot: `fix-audit500-g7-u11-after-draft-kotor-kembali.png`.

## 6. Yang TIDAK berhasil / batasan (dengan bukti)

1. **13 `reqfail` `ERR_ABORTED` untuk `/vendor/*.js` di run (c) cepat** (`verify-after.json` §c) dan 12 yang sama di run draf kotor. Bukan cacat perbaikan: itu request vendor iframe yang **dibatalkan navigasi berikutnya** (Back/Forward/klik drawer <2 dtk sesudah mount, saat vendor masih dimuat) lalu dimuat ulang di mount berikutnya. Bukti: run ulangan (c) yang menunggu "Preview siap" di tiap langkah → **0 error** dan tiap langkah mencapai "Preview siap" (`verify-after-c-slow.json`). Di pemakaian nyata (pengguna tidak menekan Back tiap 1,5 dtk) tidak terjadi.
2. **Toast pesan hash-tidak-dikenal hanya tampil 2 dtk** (timer toast yang sama untuk semua toast). Itu perilaku toast yang sudah ada; pesannya tetap tertangkap polling + screenshot. Tidak diubah supaya tidak mengubah perilaku toast global.
3. **Back melewati entri load awal tetap keluar dari aplikasi** (ke `about:blank` bila studio dibuka dari tab kosong) — itu perilaku browser yang benar untuk entri pertama; yang diperbaiki adalah Back *antar template* tidak lagi langsung keluar.
4. **Verifikasi tablet / Web Speech tidak dilakukan** — butuh perangkat Rehan; semua bukti headless 1440×900, server port 3317 (dimatikan sesudah verifikasi).

## 7. File yang diubah + bukti

**Diubah (1 file, kode studio saja):**
- `components/Studio.tsx` — `openTemplate` + `opts.push`/`pushState` (`:1355–1381`, termasuk `openTemplateRef`); init hash-tidak-dikenal (`:1412–1420`); listener `hashchange` (`:1430–1455`); situs pemanggil `{ push: true }` (`:1924` openMine, `:2246` palet, `:2716` drawer).

**Tidak disentuh:** 12 template asli di `public/templates/` (mtime tetap **2026-11-17 08:19** semua); `lib/studio.ts`, `scripts/`, `app/`, CSS; file audit (`verification/audit-500-2026-11-18.md`, mtime 2026-11-19 05:02); file bukti G1–G6 (mtime terbaru tetap 2026-11-19 09:27, sebelum kerja G7).

**Bukti baru (`verification/`, 12 screenshot + laporan ini):**
- Laporan ini: `fix-audit500-g7-u11.md`
- Sebelum: `fix-audit500-g7-u11-before-a-hash-manual.png`, `before-b-hash-tidakada.png`, `before-c-sesudah-trio.png`, `before-c-back.png` (blank), `before-c-forward.png`
- Sesudah: `fix-audit500-g7-u11-after-a-hash-manual-trio.png`, `after-b-hash-tidakada.png` (toast tampak), `after-b2-hash-tidakada.png`, `after-c-back1-trio.png`, `after-c-back2-code.png`, `after-c-fwd2-bomb.png`, `after-draft-kotor-kembali.png`

**Skrip kerja (di luar repo, persisten):** `~/workspace/g7-u11/h.mjs` (harness), `repro-before.mjs` (`repro-before.json`), `verify-after.mjs` (`verify-after.json`), `verify-after-c-slow.mjs` (`verify-after-c-slow.json`), `regression-after.mjs` (`regression-after.json`).
