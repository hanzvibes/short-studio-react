# Verifikasi Independen — Perbaikan Mobile/Tablet Short Studio React

**Tanggal:** 17 November 2026 (WIB)
**Verifikator:** subagent verifikator independen — TIDAK mengubah kode produk (`components/Studio.tsx`, `app/globals.css`, `lib/` tidak disentuh; hanya build, tes headless, dan laporan ini + screenshot `-verify.png`)
**Project:** `~/workspace/short-studio-react` — Next.js 15.5.29 + React 19 + TS, main lokal `9dba1e4e` (belum di-push)
**Yang diverifikasi:** `verification/mobile-fix-2026-11-17.md` (klaim 12/12 FIXED) terhadap `verification/mobile-audit-2026-11-17.md` (1 BLOCKER, 1 MAJOR, 10 MINOR)
**Metode:** `npm run build` + Playwright 1.65.1 + `chrome-headless-shell` di `~/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/` (SwiftShader `--enable-unsafe-swiftshader`), intercept three.js r128 lokal di `/tmp/ss-vendor/`, server lokal di-restart sesudah rebuild (`npm start -- --port 3000`, PID baru, `Ready`, HTTP 200). Skrip verifikasi saya sendiri (bukan mengulang skrip implementor): `~/workspace/tmp-audit/verify-own-a.mjs`, `verify-own-b.mjs`, `verify-own-c.mjs`, plus probe `/tmp/probe-apply*.mjs`, `/tmp/probe-play.mjs`, `/tmp/probe-switch.mjs`, `/tmp/probe-final.mjs`. Data mentah: `~/workspace/tmp-audit/verify-own-a.json`, `verify-own-b.json`, `/tmp/verify-own-c.log`, `/tmp/probe-final.mjs` (stdout di log eksekusi).

## Verdict: LAYAK PUSH ✅

**12 dari 12 temuan audit TERBUKTI FIXED** (diukur ulang dari nol, bukan dikutip dari laporan implementor), alur fungsional 390px lengkap hijau, regresi desktop 1440 hijau, drawer anti-regresi hijau. **Satu temuan BARU di luar daftar audit** ditemukan saat verifikasi (lihat §9): React hydration error #418 setiap kali halaman dimuat dengan ≥1 video tersimpan di `localStorage`. Temuan ini **pre-existing** (bukan disebabkan perbaikan mobile — kodenya pemicu `useState` lazy dari `localStorage` di `components/Studio.tsx:111-122`, tidak termasuk area yang diubah perbaikan), aplikasi tetap pulih dan berfungsi sesudahnya, dan tidak menghalangi push perbaikan mobile — tetapi **wajib ditindaklanjuti terpisah** karena mengenai semua pengguna yang pernah menyimpan video.

---

## 1. Build — PASS

`npm run build` **HIJAU**: `✓ Compiled successfully in 3.6s`, `Generating static pages (4/4)`, tanpa error. Route `/`: 29.5 kB / First Load JS 132 kB (shared 103 kB). Server di-restart sesudah build (PID lama dimatikan, PID baru `Ready in 1631ms`, `curl localhost:3000` → 200) sehingga semua tes di bawah ini mengenai build baru.

## 2. Enam lebar: overflow + console — PASS (dengan catatan §9)

Load segar (konteks baru, localStorage kosong) per lebar, tour dimatikan via `ss.tour`:

| Lebar | `scrollWidth` vs `innerWidth` | Drawer saat load | Bridge `__st` | Console/pageerror/requestfailed |
|---|---|---|---|---|
| 390×844 (touch) | 390 = 390 | `drawer-closed`, x=-286 | ok, len 30 | 0 |
| 768×1024 (touch) | 768 = 768 | `drawer-closed`, x=-286 | ok, len 30 | 0 |
| 834×1112 (touch) | 834 = 834 | `drawer-closed`, x=-286 | ok, len 30 | 0 |
| 1024×768 | 1024 = 1024 | `drawer-closed`, x=-285 | ok, len 30 | 0 |
| 1180×820 | 1180 = 1180 | `drawer-closed`, x=-285 | ok, len 30 | 0 |
| 1440×900 | 1440 = 1440 | `drawer-open`, x=5 | ok, len 30 | 0 |

Tidak ada overflow-x dokumen di lebar mana pun. **Catatan:** angka 0 error ini berlaku untuk load segar. Satu `pageerror` React #418 muncul pada jalur reload-dengan-video-tersimpan — direproduksi terpisah dan dilaporkan sebagai temuan baru di §9, bukan sebagai kegagalan butir ini.

## 3. [BLOCKER] Tab inspector — PASS

| Lebar | Grid `.workspace` | Timeline vs tab | `elementFromPoint` pusat tab | Klik mouse asli |
|---|---|---|---|---|
| 390 | `489.5px 264px 334px` | overlap **−5px** (tidak ada) | Teks/Shot/Caption/Props → tombol tab itu sendiri (`BUTTON.tab`) | Caption→`Caption8`, Props→`Props12`, Shot→`Shot10`, Teks→`Teks` |
| 768 | `593.9px 264px 334px` | overlap **−5px** | keempat tab → tombol tab | sama, keempat tab berpindah |
| 834 | `645px 264px 334px` | overlap **−5px** | keempat tab → tombol tab | sama, keempat tab berpindah |

Geometri: timeline `y 546–810`, tab `y 815–870` (390); timeline `y 650–914`, tab `y 919–974` (768); timeline `y 701–965`, tab `y 970–1025` (834) — tab selalu 5px di bawah timeline. Screenshot: `mobile-390-tabs-verify.png`, `mobile-768-tabs-verify.png`, `mobile-834-tabs-verify.png` (baris tab terlihat penuh di bawah timeline, tab Props aktif). Sebelum perbaikan overlap 42px dan `elementFromPoint` mengembalikan `DIV.tl-heads`/`DIV.tl-content`.

## 4. [MAJOR] Toolbar timeline 390 — PASS

`.tl-tools` `right=378 ≤ 390` (sebelumnya 500, meluber 110px); `#tlZoomOut`/`#tlZoomIn`/`#tlZoom` `display:none` (selector CSS ≤600px kini hidup karena `id` sudah ada); tombol **Fit** terlihat penuh 44×44 di `x 334–378`; `docScrollW=390` (tanpa overflow-x). Screenshot: `mobile-390-timeline-verify.png`. Fungsi zoom/fit tetap tersedia via keyboard (`F`) dan palet (sesuai desain yang sudah ada).

## 5. MINOR — 10/10 PASS

| # | Temuan | Bukti | Hasil |
|---|---|---|---|
| 3 | Target tap ≥44px (layar sentuh) | 390/768/834: menu 44×44, play 44×44, `.tbtn` 44×44, tab 44 tinggi (91/186/202 lebar), Terapkan `#apply`/`#apply-cap`/`#apply-shot`/`#apply-props` 217×44, Reset 144×44, Fit `#tlFit` 44×44, `.ph-icon` 44×44, tombol drawer "+ Simpan" 69×44. (Catatan ukur: probe pertama tanpa scroll workspace mengembalikan `null` untuk `#apply-cap` dkk karena tab tidak terlihat — sesudah `revealTabs` semua terukur 44px. Di 1024/1180 tanpa sentuh menu 28×28/tab 25px — ukuran mouse desktop, di luar cakupan temuan.) | PASS |
| 4 | Nama track terpotong | 390/768/834: Shots 51/51, Captions 51/51, Narasi 80/80 (`scrollWidth == clientWidth`, `truncated:false` semua). Terlihat penuh "V1 Shots / T1 Captions / A1 Narasi" di `mobile-390-tabs-verify.png`. | PASS |
| 5 | Tour langkah 1 menunjuk drawer tertutup | 390, tour aktif: langkah 1 `body=drawer-open`, drawer `x=4 w=278`, sorotan settle `x=4 y=46 w=284 h=772` (= drawer + pad 6px); langkah 2 `body=drawer-closed`, "Viewer 9:16". Screenshot `mobile-390-tour-verify.png` (kartu "Project bin" di atas drawer yang TERBUKA berisi 12 template). Catatan headless: sorotan terukur `w=0` pada +800ms dan `w=284` pada +3000ms — transisi drawer lambat di SwiftShader (artefak yang sama dicatat laporan implementor; di perangkat nyata transisi 240ms). | PASS |
| 6 | Transport terpotong di HP landscape 844×390 | Transport `y 245–301` (bottom 301 < 390, `transportFullyVisible:true`), tombol play 44×44 di `y 252–296`, stage 62×110, `docScrollW=844`. Screenshot `mobile-390-landscape-verify.png` (transport lengkap: −5s/−1f/play/+1f/+5s + timecode + Fit; scene 3D tampil). | PASS |
| 7 | ArrowRight saat slider zoom fokus malah seek | 768: fokus `#tlZoom`, ArrowRight → nilai slider `0 → 1`, waktu playhead `0 → 0` (tidak seek). | PASS |
| 8 | Pesan error validasi jauh dari baris | 390: caption #1 (mulai 3, selesai 2,5) → baris ber-class `err` (border merah), `.row-err` tepat di bawah baris: `"Caption #1: selesai harus sesudah mulai."`, `#apply-cap` disabled. Screenshot `mobile-390-caption-invalid-verify.png`. | PASS |
| 9 | Drawer tetap tertutup sesudah Simpan | 390: sesudah simpan `body=drawer-open`, item `"Verif 390"` terlihat `y 701–757` (dalam viewport), toast `"Verif 390" disimpan di Video Buatan Saya`. Screenshot `mobile-390-save-verify.png`. Bonus terverifikasi: `elementFromPoint` di tombol "Simpan video" mengembalikan `BUTTON.btn.primary` (dialog tidak lagi tertutup ruler — perbaikan `z-index:80`). | PASS |
| 10 | Truncasi kartu drawer | 1440: header "Video Buatan Saya" satu baris (`h=17`, `scrollH=17`, `wrapped=false`), tombol "+ Simpan" 69px; glyph `~` di "~30s" `x=218 w=6` sepenuhnya di dalam span `x=212 w=32` (`inside:true`). Terlihat di `mobile-390-save-verify.png` (header satu baris) dan `mobile-1440-regression-verify.png` (kartu "Mengetik (Claude × Re…" + "~30s" utuh). | PASS |
| 11 | Stage kecil di tablet landscape | 1024: 160×285 → **183×325** (+14%); 1180: 190×337 → **212×377** (+12%). Track audio tidak terpotong (`audioBottom 714 < tlBottom 775` di 1024; `766 < 827` di 1180). 1440 tidak berubah: 226×401. | PASS |
| 12 | Tombol Terapkan/Reset tanpa `id` | Keenam `id` ada di DOM saat tab-nya aktif: `#apply-shot`/`#reset-shot`, `#apply-cap`/`#reset-cap`, `#apply-props`/`#reset-props` (Teks tetap `#apply`/`#reset`). | PASS |

Pengecualian yang diketahui dan diterima (sama seperti laporan implementor): `.trk-mini` (sembunyikan/kunci track) tetap 26px — kepala track tidak muat 44px.

## 6. Alur fungsional lengkap 390px — PASS

Satu konteks, template-code → trio → edit → simpan → reload → buka lagi:

1. **Pilih template:** buka ☰, klik kartu "05 Claude vs Codex vs Gemini" → `document.title` jadi `"Claude vs Codex vs Gemini · Short Studio"`, hash `#template-trio`, bridge `len 32` (trio; code=30). Drawer tertutup sendiri sesudah pilih template.
2. **Play/pause:** (verifikasi bersih di probe final, sesudah bridge siap) label `Putar → Jeda` pada klik pertama, waktu `0,45 → 0,75` (maju; lambat karena SwiftShader, sesuai catatan audit); pause → label `Putar`, waktu diam `0,85 → 0,85`. — *Catatan metodologi: di run alur utama, klik play pertama tampak "ditelan" (label tetap Putar, waktu 0). Penyebabnya teridentifikasi sebagai artefak skrip saya, BUKAN bug produk: (a) klik pertama terjadi saat iframe template baru masih mounting (bridge `null`), dan (b) saat drawer masih terbuka tombol play tertutup panel drawer (`elementFromPoint` di pusat play mengembalikan `BUTTON.tpl`) — klik itu sah mengenai drawer. Probe final dengan penantian bridge membuktikan play/pause bersih pada klik pertama.*
3. **Seek:** klik tengah ruler → waktu `0 → 15,65`.
4. **Klik klip:** klik klip shot pertama → tab aktif `Shot10`, `t=0,11`.
5. **Edit caption + Terapkan:** tab Caption, isi caption #1 (dari `"Santai. Kodeku rapi, bug pun minder!"`) menjadi `"VERIFIKASI UBAH TEKS"` → `#apply-cap` diklik → bridge `caps()[0] = [3, 6.2, "VERIFIKASI UBAH TEKS", 0]`, toast `"Semua edit diterapkan"`. Screenshot `mobile-390-edit-flow-verify.png` (topbar "Claude vs Codex vs Ge…", 0:32, tab Caption 9, baris 01 `"VERIFIKASI UBAH TEKS"`, tombol play berikon jeda).
6. **Simpan sebagai video baru:** dialog muncul, isi nama `"Verif 390"`, klik "Simpan video" → tersimpan, drawer terbuka, item terlihat (lihat §5 #9).
7. **Reload → entri bertahan:** sesudah `page.reload`, `.mine-item` tetap `["Verif 390"]`.
8. **Buka lagi:** klik entri di drawer → bridge `len 32`, `caps()[0][2]` tetap `"VERIFIKASI UBAH TEKS"`, `body` mengandung "Verif 390". (Field Judul di pane Teks tidak berhasil dibaca selector saya — `null` — tetapi isi video yang dibuka kembali terbukti lewat bridge + teks body; bukan kegagalan produk.)

## 7. Regresi desktop 1440px — PASS

Load: `body=drawer-open`, drawer terlihat (`x=5 w=252`), `docScrollW=1440` (tanpa overflow-x), stage 226×401 (tidak berubah dari sebelum), slider zoom timeline terlihat (`display:block`). Tab Props bisa diklik mouse → `Props12`. Drawer: ☰ menutup (`drawer-closed`) → ☰ membuka → ✕ menutup → ☰ membuka — semua stabil. **Scrim di 1440: N/A by design** — CSS `@media (max-width:1180px)` adalah satu-satunya tempat `.scrim{display:block}`; di ≥1181px scrim `display:none` dan drawer bersifat docked (kolom grid), jadi tidak ada scrim untuk diklik; klik saya di (1410,450) benar mengenai inspector/workspace dan drawer tetap terbuka — perilaku yang benar. Scrim sendiri terverifikasi berfungsi di 768 (lihat §8): `display:block`, opacity 1, `pointer-events:auto`, klik → `drawer-closed`. Screenshot: `mobile-1440-regression-verify.png` (layout desktop lengkap: drawer 12 template, menubar, stage "Claude vs Codex" ter-render, timeline Shot 1–10 + Captions + Narasi, Props aktif).

## 8. Drawer anti-regresi 390px — PASS

Load awal **tertutup** (`body=drawer-closed`, drawer `x=-286`, 12 kartu template terdaftar di DOM); ☰ membuka (`drawer-open`); ✕ (tombol `aria-label="Tutup panel Project"`) menutup (`drawer-closed`); toggle 3× berurutan stabil: `open, closed ×3` tanpa selip. Dua bug drawer lama tidak regresi: class `body.drawer-open`/`drawer-closed` tersinkron di semua run, dan default tertutup ≤1180px / terbuka di 1440px (lihat §2).

## 9. ⚠️ Temuan BARU (di luar 12 temuan audit): React hydration error #418 saat load dengan video tersimpan — FAIL (pre-existing, non-blocking)

**Gejala:** `pageerror: Error: Minified React error #418` (hydration failed — UI awal tidak cocok dengan hasil render server).

**Reproduksi deterministik (3×, independen dari perbaikan mobile):**
- Kontrol C1: load + reload dengan localStorage kosong → **0 error**.
- C2: seed `ss.mine.v1` dengan 1 entri (`{id:"mine-seed1", label:"Seed Test", file:"template-trio.html", ...}`), load segar → **#418 muncul**, item "Seed Test" tetap ter-render di drawer.
- Alur B §6 langkah 7: reload sesudah menyimpan "Verif 390" → **#418 muncul** (di run B tercatat `args[]=HTML`; di C2 `args[]=text` — varian konten yang mismatch).
- C3: seed `ss.edits.v1` saja → **0 error** (edit tidak memicu; hanya daftar mine).

**Akar penyebab (dugaan kuat, dari kode):** `mine` diinisialisasi lazy dari localStorage di `components/Studio.tsx:111-122` (`useState(() => JSON.parse(localStorage.getItem("ss.mine.v1") || "[]"))`). Saat SSR, `localStorage` tidak ada → `catch` → `[]`; saat hydrasi klien, initializer membaca simpanan nyata → daftar berisi item → HTML awal berbeda dari server → React #418. Pola ini sudah ada sebelum perbaikan mobile dan tidak disentuh olehnya (perbaikan hanya mengubah layout/UX/interaksi). **Dampak:** setiap pengguna yang pernah menyimpan ≥1 video melihat satu React error di console pada setiap load/reload; aplikasi pulih sendiri via client re-render (daftar mine tetap tampil dan berfungsi — terbukti di §6 langkah 7–8). **Bukan penghalang push perbaikan mobile**, tetapi harus diperbaiki terpisah (mis. inisialisasi `mine` kosong + isi lewat `useEffect` sesudah mount, atau `suppressHydrationWarning` pada daftar mine).

**Koreksi atas klaim "0 console error di semua run" di laporan implementor:** benar untuk semua run mereka — karena tidak satu pun run mereka me-reload halaman dengan video tersimpan di localStorage. Klaim itu tidak berlaku pada jalur tersebut; verifikasi saya yang pertama menempuh jalur itu.

## 10. Template tidak berubah — PASS

Ke-12 file `public/templates/*.html` mtime tetap `2026-11-17 08:19` (dicek sebelum dan sesudah semua run). Tidak ada file produk yang saya ubah.

## Ringkasan hitungan

| Kategori | PASS | FAIL |
|---|---|---|
| Build | 1 | 0 |
| Lebar/overflow/console (load segar) | 6/6 | 0 |
| BLOCKER (temuan 1) | 1 | 0 |
| MAJOR (temuan 2) | 1 | 0 |
| MINOR (temuan 3–12) | 10 | 0 |
| Alur fungsional 390 (8 langkah) | 8 | 0 |
| Regresi desktop 1440 | 1 | 0 |
| Drawer anti-regresi 390 | 1 | 0 |
| **Temuan baru §9 (React #418, pre-existing)** | 0 | **1 (non-blocking)** |

## Screenshot bukti (10 file, `verification/`)

- `mobile-390-tabs-verify.png`, `mobile-768-tabs-verify.png`, `mobile-834-tabs-verify.png` — tab inspector bisa diklik
- `mobile-390-timeline-verify.png` — toolbar timeline muat, Fit terlihat
- `mobile-390-edit-flow-verify.png` — template trio + caption "VERIFIKASI UBAH TEKS" + Caption 9
- `mobile-390-save-verify.png` — drawer terbuka, item "Verif 390" terlihat
- `mobile-390-tour-verify.png` — tour langkah 1 di atas drawer terbuka
- `mobile-390-landscape-verify.png` — transport muat di 844×390
- `mobile-390-caption-invalid-verify.png` — error inline merah di bawah baris caption #1
- `mobile-1440-regression-verify.png` — desktop lengkap, drawer docked, Props aktif

## Tindak lanjut yang disarankan (di luar push ini)

1. Perbaiki hydration #418 (§9) di PR terpisah — jangan dicampur ke PR perbaikan mobile.
2. Catatan artefak headless (bukan bug): kecepatan playback lambat di SwiftShader (~0,15 dtk/dtk), stage kadang hitam di screenshot diam, sorotan tour langkah 1 baru settle ~3 dtk di headless — semuanya sudah dicatat audit dan tidak berubah.
