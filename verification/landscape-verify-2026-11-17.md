# Verifikasi Independen — Perbaikan Bug Landscape Short Studio React

**Tanggal:** 2026-11-17 (selesai ~21:30 WIB)
**Project:** `~/workspace/short-studio-react` (Next.js 15.5.29 + React 19 + TS, repo `hanzvibes/short-studio-react`)
**Peran:** verifikator independen (subagent). **Tidak ada file kode yang diubah** — hanya laporan +
screenshot di `verification/` dan skrip di `/tmp`. Tidak push.
**Build yang diverifikasi:** `npm run build` dari nol oleh saya, lalu `npm start -- --port 3000`.

## VERDICT: ✅ LAYAK PUSH

Semua klaim perbaikan landscape **terbukti benar dari pengukuran ulang saya sendiri** (bukan
kutipan laporan implementor): stage membesar tepat sesuai angka klaim di semua lebar, mode fokus
viewer bekerja di semua lebar landscape + Esc mengembalikan layout persis, label shot penuh,
caption ringkas tampil, `tl-content == tl-scroll` di semua lebar, 0 console error, tanpa
overflow-x, alur fungsional Trio (play/pause, klik shot, edit caption → Terapkan → bridge +
preview) lolos, regresi 390px lolos, template asli tidak disentuh.

**Satu FAIL ditemukan (FAIL-1, di bawah):** tombol "Terapkan semua edit" **tetap aktif sesudah
menerapkan edit caption/shot/props** (status "Siap diterapkan: caption." tidak pernah kembali
ke "Tidak ada perubahan"). Ini **cacat nyata, tapi NON-BLOCKING untuk push ini**: (a) editnya
sendiri **diterapkan dengan benar** (terbukti via bridge `__st.caps()`/`shots()` + preview),
tanpa kehilangan data, klik ulang idempotent; (b) **bukan regresi perbaikan landscape** —
logika `applyAll`/`capsChanged`/`shotsChanged`/`propsChanged` tidak disentuh perbaikan ini
(mekanismenya struktural: `origCaps`/`origShots`/`origProps` hanya diisi saat load template,
tidak pernah diperbarui saat apply — `Studio.tsx:646-656` vs `applyAll :743-752`); audit
pra-perbaikan tidak pernah menguji apply-clear untuk tab cap/shot/props, hanya tab Teks
(yang memang bersih). Perlu tindak lanjut tersendiri, bukan penahan push landscape.

## 1. Build dari nol

- `npm run build` (workdir bersih, server lama dimatikan dulu): **exit 0**,
  `✓ Compiled successfully in 2.6s`, `Generating static pages (4/4)`, First Load JS 133 kB (`/`).
  Log: `/tmp/verify-build.log`.
- Server baru dari build ini: `npm start -- --port 3000`, HTTP 200 (masih jalan saat laporan ditulis).

## 2. Tabel utama — ukuran frame sebelum vs sesudah (px CSS, ukuranku sendiri)

Template Adu Kode (`#template-code`, 30 dtk, 10 shot, 8 caption), `hasTouch: true`
(`pointer:coarse` aktif seperti tablet Rehan), tour ditekan (`ss.tour=1`). "Sebelum" = baseline
pra-perbaikan auditor (v2, `landscape-audit-2026-11-17.md`). "Sesudah" = hasil ukur saya.
Stage = `#stage` = `#pv` (iframe) — keduanya identik di semua run.

| Viewport | Stage sebelum (v2) | Stage sesudah (ukuranku) | Klaim implementor | Cocok? | viewerBody sesudah | `--tl-h` | Big-play |
|---|---|---|---|---|---|---|---|
| **1024×540 (Rehan)** | 45×80 | **77×137** | 77×137 | ✅ persis | 707×153 | 170px | 28px (36%) |
| 1024×768 | 168×299 | **190×337** | 190×337 | ✅ persis | 707×365 | 186px | 54px (28%) |
| 1180×820 | 197×351 | **208×369** | 208×369 | ✅ persis | 863×397 | 206px | 54px (26%) |
| **1366×768** | 143×255 | **187×333** | 187×333 | ✅ persis | 772×377 | 186px | 54px (29%) |
| 1440×900 | 218×387 | 218×387 | 218×387 | ✅ persis | 846×431 | 264px | 54px (25%) |
| 1920×1080 | 319×567 | 319×567 | 319×567 | ✅ persis | 1326×611 | 264px | 54px (17%) |
| 390×844 portrait | 197×350 | 197×350 (tak berubah) | tak berubah | ✅ | 380×366 | 218px | 54px (27%) |
| 768×1024 portrait | — | 255×454 | — | — | — | — | — |

Ambang 800px terbukti bekerja: 1366×768 kini kena pita `--tl-h:186px` (sebelumnya 264px —
meleset 8px di audit), 1440×900/1920×1080 tetap 264px (benar, tidak kena).
`tl-content == tl-scroll` di semua lebar landscape (575/575, 731/731, 640/640, 714/714,
1194/1194) — perbaikan `fitTimeline` atomik terkonfirmasi, tanpa scroll horizontal timeline.
`documentElement.scrollWidth == clientWidth` di semua lebar — **tanpa overflow-x**.
**0 console error / pageerror / requestfailed di semua run** (9 konteks browser).

### Mode fokus viewer (tombol di panel-h viewer, `aria-label` "Fokus viewer — …", `aria-pressed`)

Tombol **ada + bisa diklik di semua lebar landscape** (juga di 390px portrait).
Saat fokus: `timeline display:none`, `transport display:none`, `now-cap` tersembunyi.

| Viewport | Stage fokus (ukuranku) | Klaim | Esc → kembali? |
|---|---|---|---|
| 1024×540 | **215×382** | 215×382 ✅ | ✅ 77×137 persis, timeline+transport `display:flex` lagi |
| 1024×768 | 336×598 | — | ✅ 190×337 persis |
| 1180×820 | 366×650 | — | ✅ 208×369 persis |
| 1366×768 | **334×594** | 334×594 ✅ | ✅ 187×333 persis |
| 1440×900 | 408×726 | — | ✅ 218×387 persis |
| 1920×1080 | 510×906 | — | ✅ 319×567 persis |

## 3. Label klip timeline (Adu Kode)

**V1 — Shot.** `bTrunc=false` di semua klip di semua lebar (lebar teks ter-render via `Range`
lebih kecil dari lebar `<b>`). Visual screenshot mengonfirmasi:

| Viewport | Yang tampil |
|---|---|
| 1024×540, 1024×768 | "Shot 1"–"Shot 7", **"8"** (tiny, by-design — klip 42px), "Shot 9", "Shot 10" |
| 1180×820, 1366×768, 1440×900, 1920×1080 | **"Shot 1"–"Shot 10" penuh semua** (di 1180/1440/1920 shot 4 & 9 tampil lengkap + durasi "3.4s"/"3.6s") |

Klaim "Shot 1–Shot 10 penuh di semua lebar, satu-satunya angka adalah shot 8 di 1024" ✅
**terbukti persis** (audit v3: shot 4/9/10 masih "Sh…" — kini penuh).

**T1 — Caption (mode ringkas baru).** Kalimat utuh tetap tidak muat (wajar: teks ±150–180px
dalam klip 35–119px), tapi kata pertama kini terbaca — sesuai klaim secara substansi.
Yang tampil di screenshot saya, 1366×768: "Kodeku ra…", "Rapi doan…", "Tes banya…",
"Arsitektur…", "Eh, kod…", "Kasus u…", "Satu", "Kode terba…". Di 390px: singkatan pembicara
"Cl"/"Cx"/"Br" (mode tiny) ✅. **Selisih kecil vs klaim:** di 1024×540 screenshot saya
menampilkan 1–2 karakter lebih sedikit dari klaim ("Rapi doa…", "Tes bany…", "Eh, ko…",
"Kasus…", "Kode tert…") — kemungkinan variasi metrik font di bawah SwiftShader; substansi
(kata pertama terbaca) tetap terpenuhi, bukan FAIL.

## 4. Alur fungsional landscape — Trio, 1366×768

Template "Claude vs Codex vs Gemini" (32 dtk, 10 shot, 9 caption):

- **Pilih template** via `#template-trio` ✅ (judul "Claude vs Codex vs Gemini", status
  `12 template · 0:32 · 10 shot · 9 caption`).
- **Play/pause:** tombol transport "Putar" diklik → waktu template `gT()` bergerak 0 → 0,2
  (1,5 dtk), tombol berubah ke "Jeda", diklik lagi → tertahan di 0,3 ✅ tombol berfungsi.
  (Catatan: waktu maju lambat di bawah SwiftShader headless — artefak harness, bukan bug app;
  lihat Observasi.)
- **Klik klip shot 3:** inspector pindah ke tab Shot, "Shot terpilih", 1 klip aktif ✅.
- **Edit caption → Terapkan:** tab Caption, 9 input; isi cap 1 menjadi
  `"VERIFIKASI NYX 123 — trio bersatu"` → `#apply-cap` berubah disabled `true → false`,
  status "Siap diterapkan: caption." → klik Terapkan → **`__st.caps()[0][2]` =
  `"VERIFIKASI NYX 123 — trio bersatu"`** ✅ dan **terlihat di preview**: now-cap
  `● VERIFIKASI NYX 123 — trio bersatu` + bubble caption di dalam frame + klip timeline
  "• VERIFIKAS…" (`landscape-verify-1366-caption-edit.png`) ✅.
- **"Terapkan semua edit" saat tidak ada edit:** disabled `true` + status "Tidak ada
  perubahan — ubah teks, caption, shot, atau props untuk mengaktifkan Terapkan." ✅ by-design.
- **"Simpan sebagai video baru":** ada di tab Teks, enabled, **tidak terpotong di semua lebar
  landscape** (tepi bawah 113–618px di atas viewport: 1024×540 −113px, 1024×768 −286px,
  1180×820 −338px, 1366×768 −306px, 1440×900 −438px, 1920×1080 −618px). Catatan: tombol ini
  hanya ada di pane Teks (tiap tab punya `.insp-stick` sendiri) — di tab Caption/Shot/Props
  yang tampil hanya Terapkan + Kembalikan; itu desain per-tab, bukan bug.
- **Edit shot (probe tambahan):** Shot 1 "mulai" 0 → 0,5 → Terapkan → bridge `shots()[0][0]`
  = 0,5 ✅ (tapi lihat FAIL-1: tombol tetap aktif sesudahnya).

## 5. Regresi 390px portrait (+ 768px portrait singkat)

- Drawer **default tertutup** saat load (`body.drawer-closed`, `#drawer` x=−286, `aria-expanded=false`) ✅.
- **☰ (`#menu`, "Buka atau tutup panel Project") membuka drawer** (body `drawer-open`,
  `aria-expanded=true`, drawer x=4, transisi geser ±300–450 md) ✅; **✕ ("Tutup panel
  Project") menutup** ✅; **☰ lagi membuka lagi** ✅; **klik scrim di luar drawer (350,400)
  menutup** ✅.
- **Keempat tab inspector bisa diklik**, pane terlihat: Teks h=546, Shot h=2043, Caption
  h=609, Props h=891, semua `display:flex` ✅.
- Stage 197×350 (sama dengan baseline audit — layout ≤900px tidak berubah) ✅;
  `scrollWidth == clientWidth == 390` (tanpa overflow-x) ✅; 0 console error ✅.
- **768×1024 portrait singkat:** stage 255×454, semua label shot penuh, tanpa overflow-x,
  0 console error, keempat tab inspector terlihat ✅.

## 6. Template asli tidak disentuh

`ls -l public/templates/`: ke-12 file **mtime tetap 2026-11-17 08:19** (sama sebelum dan
sesudah verifikasi). `components/Studio.tsx` / `app/globals.css` tidak saya ubah (mtime
13:57 / 13:51 = milik implementor).

## FAIL-1 — "Terapkan" tetap aktif sesudah menerapkan edit caption/shot/props (NON-BLOCKING, pre-existing)

**Bukti (diukur 3×, dua template, dua tab):**

| Skenario | Sesudah edit | 1,5 dtk sesudah Terapkan | 3,5 dtk sesudah |
|---|---|---|---|
| Trio, tab Caption, cap 1 diubah | enabled, "Siap diterapkan: caption." | **masih enabled, "Siap diterapkan: caption."** | masih enabled |
| Adu Kode, tab Shot, Shot 1 mulai 0→0,5 | enabled, "Siap diterapkan: shot." | **masih enabled, "Siap diterapkan: shot."** | — |
| Adu Kode, tab Teks, Judul diubah (kontrol) | enabled, "Siap diterapkan: 1 teks." | disabled, "Tidak ada perubahan…" ✅ | disabled ✅ |

Editnya **diterapkan dengan benar** (bridge + preview membuktikan), tapi tombol tidak pernah
kembali abu-abu untuk cap/shot/props — pengguna tidak bisa membedakan "sudah diterapkan" dari
"belum diterapkan", dan klik ulang me-mount ulang preview tanpa guna.

**Akar (baca kode, bukan tebakan):** `capsChanged`/`shotsChanged`/`propsChanged` membandingkan
draft vs `orig*` (`Studio.tsx:646-656`), sementara `origCaps`/`origShots`/`origProps` hanya
diisi sekali saat load template (`:505-508`) dan **tidak pernah diperbarui `applyAll`**
(`:743-752` hanya memanggil `saveCurrentFullEdit()` + `mount(true)`). Jadi draft ≠ orig
selamanya sesudah edit pertama. Tab Teks bersih karena `dirty` membandingkan `fields` vs
`def` yang ikut diperbarui lewat jalur apply. Perbaikan yang benar (di luar tugas ini):
rekonsiliasi `orig*` dengan draft di `applyAll`, atau bandingkan draft dengan nilai yang
sudah diterapkan — satu tempat, berlaku untuk ketiga tab.

**Kenapa tidak memblokir push landscape:** di luar cakupan perbaikan ini (logika tersebut
tidak disentuh implementor landscape), sudah ada sebelum perbaikan (status text baru yang
justru membuatnya terlihat), tidak ada kehilangan data, dan semua kriteria landscape
terpenuhi. Disarankan sebagai follow-up terpisah, bukan penahan merge.

## Observasi minor (bukan FAIL)

1. **Chip HUD stage ("Comp 1" / "1080×1920")** di tepi atas frame tampak sedikit terpotong
   tepi atasnya di stage lebar ≥187px (mis. fokus 1366, normal 1440). Ini chrome template
   pra-perbaikan (container query hanya menyembunyikan HUD bila stage ≤150px) — kosmetik,
   bukan regresi landscape.
2. **Waktu play maju lambat di headless** (`gT()` 0 → 0,2 dalam 1,5 dtk) — putaran render
   SwiftShader; tombol play/pause dan timecode berfungsi. Perlu cek tablet Rehan untuk
   kecepatan realtime, tapi bukan bukti bug.
3. **Prefiks caption 1–2 karakter lebih pendek dari klaim** di 1024×540 (lihat §3) —
   variasi metrik font harness; substansi terpenuhi.

## Metodologi & transparansi harness

- Playwright-core + `chrome-headless-shell` (SwiftShader), `hasTouch: true`, shim CDN lokal
  byte-identik dari `/tmp/cdn-mirror` (three.js r128 + 12 skrip postprocessing + font —
  CDN tidak tertembus egress proxy dari shell headless; keterbatasan VM, bukan bug app),
  tour ditekan via `ss.tour=1`. Skrip: `/tmp/landscape-verify2.mjs` (data mentah
  `/tmp/landscape-verify2.jsonl`), probe `/tmp/probe-apply.mjs`, `/tmp/probe3.mjs`,
  `/tmp/probe4.mjs`, `/tmp/probe5.mjs`, `/tmp/probe6.mjs`.
- **Dua bug harness saya sendiri (bukan bug app), ditemukan dan diperbaiki saat verifikasi:**
  (1) run v1 crash di `page.click('#apply')` karena tiap tab inspector punya tombol apply
  sendiri (`#apply`/`#apply-shot`/`#apply-cap`/`#apply-props`) — setelah klik klip shot,
  tab berpindah dan `#apply` ter-unmount; (2) probe3 membaca state drawer dari Promise yang
  sama dua kali (hasil basi) + klik tengah `.scrim` yang tertutup drawer terbuka — setelah
  diperbaiki, drawer terbuka/tutup via ☰, ✕, dan scrim semuanya terbukti bekerja (probe4/5).

## Screenshot bukti (`verification/`, semua `-verify-*.png`)

| File | Isi |
|---|---|
| `landscape-verify-1024x540.png` / `-focus.png` | Geometri Rehan normal (77×137) + fokus (215×382) |
| `landscape-verify-1024x768.png` / `-focus.png` | 190×337 / fokus 336×598 |
| `landscape-verify-1180x820.png` / `-focus.png` | 208×369 / fokus 366×650 |
| `landscape-verify-1366x768.png` / `-focus.png` | 187×333 / fokus 334×594 |
| `landscape-verify-1440x900.png` / `-focus.png` | 218×387 / fokus 408×726 |
| `landscape-verify-1920x1080.png` / `-focus.png` | 319×567 / fokus 510×906 |
| `landscape-verify-1366-caption-edit.png` | Alur Trio: caption "VERIFIKASI NYX 123" di input + now-cap + bubble preview + Terapkan masih aktif (FAIL-1) |
| `landscape-verify-390.png` / `-drawer.png` | Regresi portrait: drawer tertutup + terbuka |
| `landscape-verify-768x1024.png` | Portrait 768px |
