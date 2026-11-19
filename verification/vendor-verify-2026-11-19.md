# Verifikasi Independen — Vendoring CDN three.js (Short Studio React)

- **Tanggal:** 2026-11-19 (11:31–~11:55 WIB, 04:31–04:55 UTC)
- **Verifikator:** worker verifikasi independen (subagent). Semua angka di bawah diukur sendiri di VM ini, bukan dikutip dari laporan implementasi.
- **Lingkup:** `~/workspace/short-studio-react`. Tidak ada file produk yang diubah (hanya file baru di `verification/`). Tidak ada push.
- **Alat:** `npm run build`, `node scripts/sync-check.mjs`, `node scripts/apply-edit.mjs`, curl ke CDN resmi, Playwright + `chrome-headless-shell` (`~/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/chrome-headless-shell`), server lokal `npm start` di **port 3101** (audit paralel memakai 3401/3402 — tidak disentuh; server audit PID 1746 dibiarkan hidup; server 3101/3102 saya matikan sesudah selesai).

## VERDICT: LAYAK PUSH ✅

Semua klaim fungsional terbukti. Satu ketidaksesuaian **non-fungsional**: klaim ukuran total "704 KB" salah — total sebenarnya **687.732 byte (671,6 KiB / 687,7 KB)**. Disarankan perbaiki angka itu di README sebelum/saat push; bukan alasan menahan push. Satu batas uji dicatat jujur di bawah (klik-buka entri "Video Buatan Saya" dari daftar belum diuji klik langsung — jalurnya terbukti satu kode dengan yang sudah diuji).

## Ringkasan angka

| Ukuran | Hasil |
|---|---|
| Template lolos CDN-diblokir (preview 3D jalan) | **12/12** |
| Template lolos CDN-diizinkan (tanpa regresi) | **12/12** |
| Request three.js ke CDN (cdnjs/jsdelivr) yang terjadi | **0** (total kedua pass; 0 percobaan) |
| Request `/vendor/*.js` | **156** (13 × 12 template, semua HTTP 200, 13 file berbeda per template) |
| Hash vendor vs unduhan langsung CDN resmi | **13/13 MATCH** |
| `npm run build` | hijau, exit 0, route `/` 49,8 kB / First Load 153 kB |
| `node scripts/sync-check.mjs` | hijau, exit 0, 12/12 byte-identik + vendor 12/12 rewrite 13/13 |
| Export `.html` | 13 referensi CDN, 0 `/vendor/`, render standalone OK |

## Per item

### 1. `npm run build` — PASS
Exit 0. `Compiled successfully in 4.2s`, lint/typecheck lolos, 4/4 static pages. Route `/`: **49,8 kB / First Load 153 kB**. Log lengkap: `/tmp/vendor-build.log` (bukan di repo).

### 2. Headless 12 template, SEMUA CDN DIBLOKIR — PASS 12/12
Skrip: `verification/vendor-verify-headless.mjs` (Playwright, `chrome-headless-shell`). Blokir via route interception (abort) untuk `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`. Setiap request jaringan dicatat.
Per template: status "Preview siap" + `__st.ok()` true + canvas ada + LEN cocok dengan `LEN=` di sumber template + 13/13 request `/vendor/` HTTP 200 + **0 percobaan request three.js ke CDN**:

| Template | LEN | Canvas | Vendor 200 | CDN three |
|---|---|---|---|---|
| template-perang.html | 34 | ya | 13/13 | 0 |
| template-code.html | 30 | ya | 13/13 | 0 |
| template-kuota.html | 34 | ya | 13/13 | 0 |
| template-rival.html | 34 | ya | 13/13 | 0 |
| template-trio.html | 32 | ya | 13/13 | 0 |
| template.html (Versus) | 28 | ya | 13/13 | 0 |
| template-typing.html | 26 | ya | 13/13 | 0 |
| template-deploy.html | 29 | ya | 13/13 | 0 |
| template-bughunter.html | 33 | ya | 13/13 | 0 |
| template-bomb.html | 33 | ya | 13/13 | 0 |
| template-meeting.html | 33 | ya | 13/13 | 0 |
| template-sleep.html | 36 | ya | 13/13 | 0 |

Catatan:
- LEN typing (26) dan deploy (29) berbeda dari label "kind" di `templates.json` (~30s / 33s) — label itu perkiraan; LEN dari sumber template (`grep LEN=` di `public/templates/`) cocok persis dengan yang dibaca bridge. Bukan defect.
- 11 dari 12 template mencatat 1 console error `Failed to load resource: net::ERR_FAILED` — itu request **Google Fonts yang diblokir** (sengaja, sesuai keputusan font tetap CDN dan jatuh ke font sistem). Template sleep 0 error. Bukan defect vendor.
- Bukti: `verification/vendor-verify-headless-blocked.json` + 12 screenshot `verification/vendor-cdn-blocked-<slug>.png`.

### 3. Tanpa blokir CDN (regresi) — PASS 12/12
Pass kedua dengan skrip sama, `BLOCK_CDN=0`: **12/12 OK** (LEN/canvas sama), request `/vendor/` tetap 13/13 per template, dan **request three.js ke CDN tetap 0** — rewrite bekerja bahkan saat CDN diizinkan. Bukti: `verification/vendor-verify-headless-allowed.json` + 12 screenshot `verification/vendor-cdn-allowed-<slug>.png`.

### 4. `public/vendor/` ter-serve HTTP 200 — PASS
Dari server lokal port 3101: `/` 200, `/vendor/three.min.js` 200, `/vendor/EffectComposer.js` 200, `/vendor/CopyShader.js` 200. `three.min.js` yang ter-serve hash-nya `9274bbce…a2c1ce2` (cocok dengan file disk).

### 5. Template asli & file audit tidak berubah — PASS (dengan catatan)
- 12 file `public/templates/`: **mtime semua masih 2026-11-17 08:19**, tidak berubah.
- File audit `verification/audit500-*` / `verification/audit-500-*.md`: saya **tidak membuka/menulis satu pun**. Perbandingan daftar sebelum–sesudah: 1467 file → 1468 file; satu-satunya selisih adalah **1 file BARU dari audit paralel** (`verification/audit500-reverify-a-a8b-json-rusak.png`, 2026-11-19 04:32:43 UTC — dibuat saat tugas saya baru mulai), tanpa penghapusan. `audit-500-2026-11-18.md` mtime-nya maju selama run saya — itu audit paralel yang sedang aktif menulis laporannya sendiri, bukan pekerjaan saya (saya tidak pernah menyentuh file itu).

### 6. Export tetap CDN + render standalone — PASS
- `node scripts/apply-edit.mjs --file template-code.html --title 'Judul Verifikasi Vendor' --out verification/vendor-export-test.html` → exit 0. Isi file: **1× cdnjs + 12× jsdelivr = 13 referensi CDN three.js, 0× `/vendor/`**, font Google tetap CDN (2 referensi). Sesuai keputusan export (a).
- Render standalone: `verification/vendor-verify-export.mjs` — file dibuka via HTTP lokal (port 3102, sudah dimatikan), request CDN three.js dipenuhi dari salinan `/tmp/cdn-check` yang sudah terbukti byte-identik dengan CDN resmi (browser headless VM ini tidak bisa mencapai CDN langsung — `ERR_CONNECTION_RESET` via egress proxy; pemenuhan dari salinan terverifikasi adalah substitusi yang sah). Hasil: `THREE` terdefinisi, `renderAt(12)` jalan, canvas 632×1125, **13 request CDN three.js, 0 request `/vendor/`, 0 error**. Screenshot: `verification/vendor-export-render.png`, data: `verification/vendor-export-render.json`.
- Koreksi metode: template mentah **tidak punya bridge `__st`** (bridge hanya diinjeksikan Studio saat preview), jadi probe export memakai `renderAt` bawaan template, bukan `__st.ok()`. Percobaan pertama saya yang memakai `__st` gagal karena alasan ini — bukan karena export rusak.

### 7. Hash vendor vs CDN resmi — PASS 13/13
`curl` langsung ke CDN resmi (cdnjs + jsdelivr three@0.128.0) lalu `sha256sum`, dibandingkan dengan `public/vendor/`:

| File | Hasil |
|---|---|
| three.min.js | MATCH (`9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2` — cocok dengan nilai penuh di tugas) |
| CopyShader.js | MATCH (`6b5da4fe3b410286974590885f82fe4a446f25c728f7d6c888e2a2a331333949` — cocok dengan nilai penuh di tugas) |
| LuminosityHighPassShader.js, BokehShader.js, AfterimageShader.js, FXAAShader.js, EffectComposer.js, MaskPass.js, ShaderPass.js, RenderPass.js, BokehPass.js, UnrealBloomPass.js, AfterimagePass.js | MATCH semua (11/11) |

Hash lengkap terukur: `sha256sum public/vendor/*.js` (13 baris, cocok dengan tabel README yang bentuknya terpotong `…`).

**Ketidaksesuaian (minor, non-fungsional): klaim "total 704 KB" SALAH.** Ukuran terukur: `du` = **687.732 byte** total 13 file (three.min.js 603.445 B + 12 file lain 84.287 B) = **671,6 KiB / 687,7 KB**. Bukan 704 KB dalam satuan apa pun. Perbaiki angka di README (mis. "688 KB / 687.732 byte").

### 8. `node scripts/sync-check.mjs` — PASS
Exit 0, `sync-check: SEMUA HIJAU`: 12/12 template byte-identik lib==mjs, `OK vendor three.js: 12/12 template rewrite 13/13 + export tetap CDN`, 2 contoh spec exit 0.

### 9. Rewrite di satu tempat, satu call site — PASS (kode + live)
- `grep -rn rewriteThreeCdnToLocal lib/ components/ app/ scripts/`: definisi di `lib/studio.ts:157`; **satu-satunya pemanggilan produk di `components/Studio.tsx:1068` dalam `mount()`**, tepat sebelum `pv.srcdoc = out`. `scripts/sync-check.mjs:199` memanggilnya hanya untuk verifikasi; `scripts/export.mjs` hanya menyebut di komentar. `applyEdits`/`downloadMine` tidak me-rewrite (export tetap CDN — terbukti item 6).
- **Live — jalur edit tersimpan:** `verification/vendor-verify-edit-reprobe.mjs` — buka template-code, ubah judul → Terapkan, CDN diblokir: bridge `ok=true`, `len=30`, canvas ada, judul baru tampil di iframe (`Judul Reprobe…`), **0 request CDN three.js, 13 file `/vendor/`**. (Percobaan pertama `vendor-verify-editflow.mjs` sempat membaca bridge `null` sekali tepat sesudah klik Terapkan — itu artefak timing: probe mendarat saat iframe sedang reload; re-probe dengan polling 30 detik mengonfirmasi OK. Setelah klik "Simpan sebagai video baru" preview tetap `ok=true, len=30`.)
- **Batas uji (jujur):** membuka entri tersimpan dari daftar "Video Buatan Saya" **dengan klik langsung belum diuji** — selector daftar saya (`#mineList .mine`) mengembalikan 0 dan tidak saya kejar lebih jauh. Yang terbukti: (a) kode — semua jalur preview melewati `mount()` yang sama (satu-satunya call site), (b) live — template asli 12/12 + edit tersimpan. Risiko sisa kecil karena mekanismenya identik.

## File bukti (di `verification/`)

- Laporan ini: `verification/vendor-verify-2026-11-19.md`
- Skrip verifikasi: `vendor-verify-headless.mjs`, `vendor-verify-export.mjs`, `vendor-verify-editflow.mjs`, `vendor-verify-edit-reprobe.mjs`
- Data terukur: `vendor-verify-headless-blocked.json`, `vendor-verify-headless-allowed.json`, `vendor-export-render.json`, `vendor-verify-editflow.json`
- Export: `vendor-export-test.html` (+ `vendor-export-render.png`)
- Screenshot: `vendor-cdn-blocked-<slug>.png` (12), `vendor-cdn-allowed-<slug>.png` (12), `vendor-cdn-blocked-editflow.png` (1)

## Catatan lain untuk koordinator

- Direktori `~/workspace/short-studio-react` **bukan repo git** (`git status` → `fatal: not a git repository`); jadi status branch/commit tidak bisa saya verifikasi — penilaian "layak push" didasarkan pada working tree saja.
- Server lokal saya (3101 Next, 3102 python http.server) sudah dimatikan; server audit (PID 1746, sejak 04:06) tidak disentuh.
- Rekomendasi sebelum push: betulkan angka "704 KB" di README menjadi 687.732 byte (~688 KB). Tidak ada FAIL fungsional.
