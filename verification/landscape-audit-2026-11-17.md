# Audit Landscape — Short Studio React

**Tanggal:** 2026-11-17 (20:xx WIB)
**Project:** `~/workspace/short-studio-react` (Next.js 15.5.29 + React 19 + TS)
**Template yang diaudit:** Adu Kode (`template-code.html`, 30 dtk, 10 shot, 8 caption)
**Status repo saat audit:** direktori kerja **bukan** checkout git (tidak ada `.git`, hanya `.gitignore`) —
klaim koordinator "main `d62a67e6`" tidak dapat diverifikasi dari workdir ini.
**Peran:** auditor read-only — tidak ada file kode yang diubah.

## ⚠️ Temuan proses: perbaikan paralel mendarat DI TENGAH audit

Selama audit ini, seorang pekerja paralel (bukan saya) mengedit `app/globals.css`
dan `components/Studio.tsx` dan me-rebuild `.next` + me-restart server:

| Waktu (UTC) | Kejadian |
|---|---|
| ~13:24–13:27 | Run pengukuran **v2** — build LAMA (pra-perbaikan) |
| 13:36:48 | `components/Studio.tsx` diedit |
| 13:39:02 | `app/globals.css` diedit |
| 13:39:15–23 | `.next` di-rebuild |
| 13:36–13:41 | Run pengukuran **v3** + probe — berjalan **di tengah** edit/rebuild di atas; |
| | hasilnya sudah mengandung build BARU (terbukti dari isi chunk/CSS live, lihat bawah) |
| 13:41:01 | `components/Studio.tsx` diedit lagi |
| 13:41:32–49 | `.next` di-rebuild lagi; server di-restart (PID baru 7854, `next start --port 3000`) |

Akibatnya laporan ini punya **dua lapis angka**:

- **v2 = baseline pra-perbaikan.** Inilah yang mereproduksi screenshot Rehan **persis**
  (stage 45×80 di 1024×540, label "S…"/"Sh…", timeline meluber 40 px).
- **v3 + probe 1024×768 = build SAAT INI** (terverifikasi: chunk live mengandung
  `r<6?" tiny":r<11?" compact":""` dan CSS live mengandung `--tl-h:170px/186px/206px`).
  Semua angka "saat ini" di bawah berasal dari lapis ini.

Perbaikan yang sudah mendarat di kode (bukan oleh saya) dan sudah **terbukti bekerja**:

1. **Timeline ringkas di viewport pendek** — `app/globals.css:447–464`
   (`--tl-h:186px` bila lebar >900 px dan tinggi ≤760 px; `--tl-h:170px` bila tinggi ≤640 px),
   plus baris timeline ≤1180 px jadi **206 px + `max-height`** (`globals.css:434–440`,
   komentarnya menyebut nilai lama 224 px "membuat panel meluber 40px ke bawah menutupi status bar").
2. **Ambang `compact`/`tiny` klip dilonggarkan** — `components/Studio.tsx:1828`:
   dulu `wPct < 2 ? tiny : wPct < 6 ? compact`, kini `wPct < 6 ? tiny : wPct < 11 ? compact`.
   `compact` menyembunyikan durasi + sub-judul (`globals.css:266`), sehingga judul muat.
3. **Tombol big-play dibatasi** — `globals.css:155`: dulu `width:52px;height:52px`,
   kini `width:min(54px,36%)` (relatif terhadap lebar stage).

Sisa yang **belum** diperbaiki ada di "Rekomendasi" di bawah.

## Metode

- Server lokal `npm start -- --port 3000` (saya yang menjalankan pertama; lalu di-restart pekerja paralel).
- Browser: `chrome-headless-shell` + Playwright (`playwright-core` dari `node_modules` proyek),
  `hasTouch: true` (tablet → aturan `pointer:coarse` aktif, sama seperti tablet Rehan),
  `deviceScaleFactor: 1`, konteks baru per viewport (localStorage bersih).
- **Shim CDN (hanya di harness tes, kode app tidak disentuh):** template memuat three.js r128
  + 12 skrip postprocessing/shader dari `cdnjs`/`jsdelivr` + font Google. Di VM ini shell
  headless tidak bisa menembus egress proxy (`ERR_TUNNEL_CONNECTION_FAILED` untuk semua CDN;
  `curl` ke CDN yang sama berhasil 200). Tanpa shim, iframe gagal (`THREE is not defined`,
  `LEN is not defined`), stage tidak pernah `.ready`, timeline hanya menampilkan placeholder
  "Komposisi" dan klip kosong. Saya mengunduh ke-13 file JS + CSS font + woff2 lewat `curl`
  ke `/tmp/cdn-mirror/` dan menyajikannya lewat `page.route()`. Dengan shim, semua run
  mencapai `#stage.ready` dan status `12 template · 0:30 · 10 shot · 8 caption`.
  Ini keterbatasan lingkungan VM, **bukan** bug app — tapi app memang tidak punya fallback
  lokal bila CDN mati (pesan errornya sendiri berkata begitu, `Studio.tsx:398`).
- Tour first-run (`ss.tour`) ditekan lewat `addInitScript` di run v3, karena di run v2 tour
  otomatis muncul 750 ms sesudah ready dan **membuka drawer + menutupi stage** di screenshot —
  run v2 mengukur layout yang sama, tapi screenshot-nya tidak mewakili tampilan Rehan
  (Rehan sudah melewati tour). Tour juga sempat menggeser scroll `.panes` di 390 px (lihat Temuan 3).
- Skrip ukur: `/tmp/landscape-audit2.mjs` (v2), `/tmp/landscape-audit3.mjs` (v3),
  `/tmp/probe-1024x768.mjs`; data mentah `/tmp/landscape-measure2.json`,
  `/tmp/landscape-measure3.json`, `/tmp/probe-1024x768.json`.
- Hash yang benar untuk template Adu Kode adalah `#template-code`
  (`slug = file tanpa .html`, `lib/studio.ts:14`); `#adu-kode` tidak cocok dan jatuh ke template pertama.

## Geometri viewport Rehan (diturunkan dari screenshot)

File `~/workspace/user/files/634183_0_gqq9.png` berukuran **2048×1045 px**.
Pengukuran piksel langsung (PIL):

- Tombol play transport (biru): 85×86 px. `.play` = 44 px di `pointer:coarse` + ≤1180 px
  → **DPR ≈ 2** (86/44 ≈ 1,95). Tombol Ekspor 154×85 px → 85/44 ≈ 1,93. Konsisten.
- Strip stage: piksel terang x 679–769 (90 px), y 190–339 (149 px) → **≈ 45×75 CSS px**.
- Tinggi timeline di gambar ≈ 450 px → 225 CSS px ≈ `--tl-h` 224 px (pra-perbaikan).

Jadi viewport CSS Rehan ≈ **1024×~540 px @ DPR 2** (tablet landscape pendek — mungkin
jendela browser yang tidak penuh / ada bilah sistem). Lebar 1024 px, tinggi hanya ~540 px.
**Ini yang direproduksi persis oleh run v2 di 1024×540: stage 45×80 px.**

## Tabel utama — ukuran frame vs stage (px CSS)

Stage dihitung `fitStage` sebagai fit-to-height (lihat Akar Masalah 1). `viewerBody` =
ruang kanvas di dalam panel viewer (setelah panel-h + now-cap + transport).

### Build SAAT INI (v3 + probe 1024×768)

| Viewport | Stage (9:16) | viewerBody | Stage ÷ tinggi viewerBody | Stage ÷ lebar viewer | Timeline `--tl-h` | Big-play |
|---|---|---|---|---|---|---|
| 390×844 (kontrol portrait) | 197×350 | 380×366 | 96% | 52% | 218 | 54 px (27% lebar stage) |
| **1024×540 (Rehan)** | **70×125** | 707×153 | 82% | 10% | 170 | 25 px (36%) |
| 1024×600 | 104×185 | 707×213 | 87% | 15% | 170 | 37 px (36%) |
| 1024×768 | 178×317 | 707×345 | 92% | 25% | 206 | 54 px (30%) |
| 1180×820 | 208×369 | 863×397 | 93% | 24% | 206 | 54 px (26%) |
| 1366×768 | 143×255 | 772×299 | 85% | 19% | 264 | 51 px (36%) |
| 1440×900 | 218×387 | 846×431 | 90% | 26% | 264 | 54 px (25%) |
| 1920×1080 | 319×567 | 1326×611 | 93% | 24% | 264 | 54 px (17%) |

### Baseline PRA-PERBAIKAN (v2) — yang sama dengan screenshot Rehan

| Viewport | Stage | viewerBody | Timeline |
|---|---|---|---|
| 1024×540 | **45×80** | 707×99 | 264 (meluber 40 px dari baris 224) |
| 1024×600 | 74×131 | 707×159 | 264 (meluber) |
| 1024×768 | 168×299 | 707×327 | 264 (meluber) |
| 1180×820 | 197×351 | 863×379 | 264 (meluber) |
| 1366×768 / 1440×900 / 1920×1080 / 390×844 | sama dengan tabel "saat ini" | | |

Perbaikan timeline ringkas menaikkan stage di 1024×540 dari 45×80 → **70×125**
(+56% tinggi). Tetap kecil: stage hanya 125 px di viewport 540 px, dan big-play
25 px masih menutupi 36% lebar stage.

## Temuan 1 — STAGE TERLALU KECIL ✅ direproduksi persis (pra-perbaikan), ⚠️ sebagian diperbaiki

**Bukti.** Run v2 1024×540: stage 45×80 px, viewerBody 707×99 px — sama dengan strip
di screenshot Rehan (45×75 CSS px dari pengukuran piksel). Big-play 52 px saat itu
**lebih lebar dari stage itu sendiri (116% lebar stage)** dan menutupinya; `.stage`
punya `overflow:hidden` sehingga lingkaran terpotong di kiri-kanan. Di build saat ini
stage 70×125, big-play 25 px (36%) — jauh lebih baik, tapi stage tetap strip kecil
di tengah lautan hitam: lebar stage hanya 10% dari lebar viewer (70 dari 707 px).

**Akar masalah — BUKAN bug rumus fit, melainkan anggaran tinggi.**
`fitStage` (`components/Studio.tsx:288–301`) matematikanya benar:

```js
const availW = r.width - padPx*2, availH = r.height - padPx*2;
let h = Math.min(availH, availW*16/9);
if (vZoom) h *= vZoom/100;
stage.style.height = h; stage.style.width = h*9/16;
```

Stage memang sudah "fit-to-height" — masalahnya **tidak ada tinggi tersisa untuk di-fit**.
Anggaran vertikal di 1024×540 (pra-perbaikan), semua angka terukur:

| Pos | Tinggi |
|---|---|
| Topbar (`--topbar-h`, `globals.css:13`, `.app` `:45`) | 48 |
| Status bar (`--status-h`) | 28 |
| Padding/gap workspace (`globals.css:94`) | 10 |
| Baris timeline (`--tl-h`) | 224 (pra-perbaikan) |
| Panel-h viewer (44 px di `pointer:coarse` ≤1180 px, `globals.css:96` + `:563`) | 44 |
| Now-cap (`globals.css:177`) | 24 |
| Transport (42 px normal `:182`, **56 px** di `pointer:coarse` `:545`) | 56 |
| **Sisa untuk viewerBody** | **99** |
| minus padding fitStage 2×14 (`Studio.tsx:294`) | **stage 80 → terukur 45×80** |

Catatan: `vZoom` **bukan** penyebab — di semua run nilainya `Fit` (0), sama seperti
dropdown "Fit" di screenshot Rehan; `ss.vzoom` hanya diterapkan bila 50/75
(`Studio.tsx:620–621`). Menutup drawer media juga **tidak** membantu tinggi stage:
stage dibatasi tinggi, bukan lebar (drawer hanya melebarkan lajur timeline).

**Yang sudah diperbaiki:** aturan landscape-pendek (`globals.css:458–463`) memangkas
baris timeline 224 → 170 px (dan track: ruler 24, shot 46, caption 36, audio 28),
sehingga viewerBody 99 → 153 px dan stage 45×80 → 70×125 px.

**Sisa masalah:**

1. **Ambang ketinggian meleset 8 px untuk ukuran tablet paling umum.**
   Aturan 186 px hanya berlaku `max-height:760px`; **1366×768 (tinggi 768) tidak kena**,
   jadi stage di sana tetap 143×255 dengan timeline 264 px. 1280×800 juga lolos.
   Di 1366×768 stage hanya 19% lebar viewer dan 85% tinggi viewerBody.
2. Bahkan pasca-perbaikan, di geometri Rehan stage cuma 70×125 px.
   Satu-satunya cara membesarkan secara signifikan adalah merebut ruang vertikal
   (timeline/transport bisa dilipat), bukan mengutak-atik rumus fit.
3. Anomali kecil pra-perbaikan (tidak lagi ter-reproduksi): di v2 stage inline
   `80px` padahal anggaran `availH` saat diukur 71 px (viewerBody 99 − 28) —
   `fitStage` hanya jalan ulang saat resize/drawer/ready (`Studio.tsx:303–326`),
   jadi hasil ukur yang basi tidak dikoreksi bila layout bergeser 9 px sesudahnya.
   Di build saat ini angkanya konsisten (153 − 28 = 125 ✓, terkonfirmasi probe
   resize 540→541→540: 125→126→125).

**Screenshot:** `landscape-1024x540-before.png` (bandingkan dengan screenshot Rehan),
`landscape-1366-before.png` (stage 143×255, big-play menutupi 36% lebar stage).

## Temuan 2 — LABEL KLIP TIMELINE TERPOTONG ✅ direproduksi, ⚠️ sebagian diperbaiki

**Bukti (build saat ini).** Lajur timeline Adu Kode (30 dtk):

| Viewport | Lebar lajur (`.tl-scroll`) | Klip V1 (2,2–3,6 dtk) | Klip T1 |
|---|---|---|---|
| 1024 (semua tinggi) | 575 px → 19,2 px/dtk | 42–69 px | 35–58 px |
| 1180 | 731 px → 24,4 px/dtk | 54–88 px | 44–73 px |
| 1366 | 640 px → 21,3 px/dtk | 47–77 px | 38–64 px |
| 1440 | 714 px → 23,8 px/dtk | 52–86 px | 43–71 px |
| 1920 | 1194 px → 39,8 px/dtk | 88–143 px | 72–119 px |
| 390 | 280 px → 9,3 px/dtk | 21–34 px | 17–28 px |

("Timeline ~1400 px untuk 30 detik" di brief tidak cocok dengan pengukuran:
lajur di screenshot Rehan ≈ 590 CSS px — 1185 px gambar @ DPR 2 — sesuai 575 px
terukur di lebar 1024.)

**V1 (shot).** Pra-perbaikan, judul "Shot 1" (butuh ±32 px) hanya mendapat
19–28 px di lebar 1024/1366 → tampil "S…"/"Sh…" + durasi "3.1s" — **persis
screenshot Rehan**. Pasca-perbaikan (ambang `compact` baru, `Studio.tsx:1828`),
klip dengan `wPct < 11` menyembunyikan durasi + sub-judul (`globals.css:266`)
sehingga judul muat penuh: di 1024×540 tampil "Shot 1", "Shot 2", "Shot 3",
"Shot 5"–"Shot 8". **Sisa:** shot terpanjang (3,4–3,6 dtk, `wPct` 11,3–12%)
tidak kena `compact`, durasi tetap tampil dan judul terpotong "Sh…" + sub "0 …".
Di 1366: shot 4, 9, 10 masih "Sh…". Di 1440/1920 semua judul shot muat.
Di 390, klip hanya 21–34 px — judul tetap terpotong di semua shot
(`truncated: true` untuk ke-10 shot).

**T1 (caption).** **Tidak tersentuh perbaikan.** Kalimat caption utuh
("Kodeku rapi. Satu fungsi, satu tugas.", dst) dimasukkan ke klip 35–119 px
dengan ellipsis (`globals.css:251` + `.clip-txt` ellipsis):

| Viewport | Teks terlihat (klip caption 1) |
|---|---|
| 1024 | "Kodeku r…" (±44 px dari 180 px yang dibutuhkan) |
| 1366 | "Rapi do…" / "Tes bar…" — sesuai screenshot Rehan |
| 1440 | ±59 px dari 180 px |
| 1920 | ±107 px dari 180 px — tetap terpotong |

Label caption praktis tidak bisa dipakai untuk mengenali isi di lebar ≤1440 px.

**Akar masalah.** Lebar klip = durasi/30 × lebar lajur (`pct()`, `Studio.tsx:1042`;
lebar lajur di-fit ke viewport lewat `fitPps`, `:1043`). Di dalam klip 59 px,
padding 12 px + gap 5 px + `.clip-time` ±22–25 px (`globals.css:251–256`,
`flex:0 0 auto`) menyisakan ±20 px untuk judul — kurang dari "Shot 1" (±32 px).
Ambang lama (`wPct<2 tiny`, `<6 compact`) tidak pernah kena untuk shot 7–12%.
Perbaikan menaikkan ambang jadi `<6 tiny`, `<11 compact` — tepat sasaran, tapi
(1) shot terpanjang lolos dari ambang, (2) caption tidak punya mode ringkas
(tidak ada `tiny`/`compact` untuk `.clip.cap`).

## Temuan 3 — INSPECTOR

### 3a. "Terapkan semua edit" abu-abu — ✅ BY-DESIGN, bukan bug

Kondisi disabled (`components/Studio.tsx:1935`):

```js
disabled={!ready || !anyDirty || allErrors.length > 0}
```

dengan `anyDirty = dirty || capsChanged || shotsChanged || propsChanged || perubahan VO`
(`:705–710`, guard yang sama di `applyAll`, `:735–736`). Tanpa edit, `anyDirty`
false → tombol mati. **Terbukti langsung:** di 1366, mengetik "X" di kolom Judul
mengubah `applyDisabled` true → false (bukti `landscape-1366-after-edit.png`).
UI-nya sendiri menjelaskan: hint di bawah tombol berbunyi *"Tidak ada perubahan —
ubah teks, caption, shot, atau props untuk mengaktifkan Terapkan."* Tidak perlu diperbaiki;
paling banter jadikan hint itu lebih terlihat.

### 3b. "Simpan sebagai video baru" — ✅ TIDAK terpotong di landscape, ⚠️ perlu scroll di 390 px

Tombol ini hanya disabled saat `!ready` (`Studio.tsx:1944–1947`), dan di semua
lebar landscape tepi bawahnya berada **di dalam** viewport:

| Viewport | Bawah tombol vs bawah viewport |
|---|---|
| 1024×540 | 113 px |
| 1024×600 | 118 px |
| 1024×768 | 286 px |
| 1180×820 | 338 px |
| 1366×768 | 306 px |
| 1440×900 | 438 px |
| 1920×1080 | 618 px |

Di screenshot Rehan tombol ini memang "mepet" tepi bawah, tapi **tidak terpotong** —
di bawahnya masih terlihat baris meta "0:30 · 10 shot · 8 caption". Yang benar-benar
butuh scroll di 1024×540 adalah `.panes` inspector (`clientH` 370 vs `scrollH` 560,
`globals.css:290` `overflow:auto`): daftar prop (Durasi/Shot/Caption/Template)
di bawah tombol hanya terlihat sesudah menggulir panel inspector.

**Portrait 390×844 (kontrol):** inspector berada di bawah lipatan (workspace
`scrollH` 1104 vs `clientH` 768). Sesudah menggulir workspace sampai bawah,
tombol Simpan **terlihat** (y 684–728 < 844) — bisa dicapai hanya dengan scroll
workspace. (Pengukuran v2 sempat menunjukkan sebaliknya, tapi itu artefak tour
yang menggeser scroll `.panes`; di v3 dengan tour ditekan, hasilnya bersih.)
Yang tetap butuh scroll `.panes` hanyalah konten di bawah tombol Simpan.

## Temuan 4 — Elemen lain di landscape

- **Header stage / transport / ruler / playhead / status bar: normal.**
  Panel-h 44 px (≤1180, coarse) / 32 px (>1180); now-cap 24 px; transport 56 px
  (coarse, `:545`) — semua tombol terlihat; timecode `00:00:00:00 / 00:00:30:00`;
  zoom "Fit"; ruler 0:00–0:30 tiap 5 dtk (di 1920 tiap 2 dtk, karena ruler
  merapatkan langkah saat px/dtk besar); playhead di 0:00; status bar
  "● Preview siap · 12 template · 0:30 · 10 shot · 8 caption".
- **Timeline meluber (PRA-PERBAIKAN, sudah diperbaiki).** Panel timeline punya tinggi
  inline `tlHeight` 264 px (`Studio.tsx:177,1708`) sementara baris grid-nya
  224 px di ≤1180 px → panel meluber 40 px ke bawah dan `scrollHeight` workspace
  melebihi `clientHeight` 35 px (terukur di 1024/1180 v2). Perbaikan
  `--tl-h:206px` + `.timeline{max-height:var(--tl-h)}` (`globals.css:439–440`)
  menutup lubang ini di build saat ini (`scrollH == clientH`).
- **Tour first-run mengotori pengukuran.** Tour muncul 750 ms sesudah ready
  (`Studio.tsx:438`) dan di ≤1180 px membuka drawer (`:1266`) — screenshot run
  pertama saya menunjukkan drawer + kartu tour, bukan tampilan Rehan. Bukan bug
  produk, tapi jebakan verifikasi: screenshot headless harus menekan tour dulu.
- **Tidak ada overflow horizontal** di semua lebar (`scrollWidth == clientWidth`).

## Rekomendasi perbaikan (spesifik, terurut)

1. **Turunkan ambang "landscape pendek" supaya 1366×768 kena** — `globals.css:458`:
   ubah `max-height:760px` → `max-height:800px` (atau jadikan aturan berbasis
   tinggi viewport saja, tanpa syarat lebar). Ini satu-satunya perubahan yang
   memperbaiki ukuran tablet landscape paling umum (stage 143×255 → ±143×300
   dengan `--tl-h:186px`). Waspadai efek ke 1440×900 (900 > 800, tidak kena — benar).
2. **Beri mode "fokus viewer" / lipat timeline + transport** — tombol di panel-h
   viewer yang menyetel `--tl-h` ke ±90 px (ruler + 1 track ringkas) atau
   menyembunyikan panel timeline sepenuhnya. Inilah satu-satunya jalan agar stage
   9:16 di 1024×540 bisa melewati ~150 px tingginya; mengutak-atik `fitStage`
   tidak akan membantu karena stage sudah fit-to-height.
3. **Samakan perlakuan caption dengan shot** — terapkan kelas ringkas pada
   `.clip.cap` juga (mis. sembunyikan teks dan tampilkan hanya titik +
   nomor/singkatan pembicara bila lebar klip < ~70 px), atau tampilkan
   2 kata pertama saja. Saat ini caption tidak punya mode ringkas sama sekali.
4. **Naikkan ambang `compact` shot jadi 13%** (`Studio.tsx:1828`) atau putuskan
   berdasar lebar piksel klip, bukan persen durasi — supaya shot 3,4–3,6 dtk
   (11,3–12%) juga menyembunyikan durasi dan judulnya tidak lagi "Sh…".
   Alternatif: pindahkan durasi ke baris `small` (gabung "Shot 4 · 3.4s")
   sehingga tidak ada elemen `flex:0 0 auto` yang mencaplok 25 px.
5. **Pertahankan perbaikan big-play** (`width:min(54px,36%)`, `globals.css:155`) —
   sudah benar; pra-perbaikan 52 px menutupi 116% lebar stage di 1024×540.
6. **Jangan ubah perilaku "Terapkan"** — disabled tanpa edit itu by-design dan
   sudah dijelaskan hint di UI. Bila mau, buat hint selalu terlihat (saat ini
   hint berada di bawah tombol Simpan, di area `.panes` yang harus di-scroll
   di viewport pendek).
7. **(Opsional, robustness)** — template bergantung penuh pada CDN three.js;
   bila CDN mati, stage tidak pernah ready dan timeline kosong. Pertimbangkan
   mem-vendor-kan three.js r128 + 12 skrip postprocessing ke `public/vendor/`
   (pola yang sudah dipakai template HyperFrames) agar preview tidak mati
   tanpa internet.

## Screenshot (semua di `verification/`, build saat ini, tour ditekan)

| File | Isi |
|---|---|
| `landscape-1024x540-before.png` | Geometri Rehan — stage 70×125, klip "Shot 1" penuh, "Sh…" di shot 4/9/10 |
| `landscape-1024x600-before.png` | Stage 104×185 |
| `landscape-1024-before.png` | Stage 178×317, timeline 206 |
| `landscape-1180-before.png` | Stage 208×369 |
| `landscape-1366-before.png` | Stage 143×255 — ambang 760 px meleset 8 px; big-play 51 px |
| `landscape-1440-before.png` | Stage 218×387 |
| `landscape-1920-before.png` | Stage 319×567; semua judul shot muat |
| `landscape-390-before.png` | Kontrol portrait — stage 197×350, normal |
| `landscape-1366-after-edit.png` | Bukti "Terapkan" aktif sesudah edit Judul |

Catatan: `landscape-1024x576-before.png` (13:29) **bukan** dari run saya — jangan
dihapus/dianggap bagian dari audit ini.

## Caveat metodologi

- Pengukuran memakai `chrome-headless-shell` + SwiftShader + shim CDN lokal
  (file CDN byte-identik dari `curl`, disajikan via `page.route()`). Render 3D
  dan font Plus Jakarta Sans mungkin sedikit berbeda dari tablet Rehan, tapi
  **semua angka layout** (rect, clientWidth/scrollWidth, disabled, scroll)
  diukur dari DOM/CSS yang sama dengan yang diterima tablet.
- `hasTouch: true` dipakai agar aturan `pointer:coarse` (transport 56 px,
  tombol 44 px, panel-h 44 px) aktif seperti di tablet.
- Run v2 mengukur build lama karena `.next` di-rebuild pekerja paralel di tengah
  audit; run v3 + probe mengukur build yang sedang berjalan sekarang (server
  PID 7854, start 13:41 UTC, `.next` 13:41:32–49). Bila pekerja paralel masih
  mengedit, angka di sini bisa bergeser — verifikasi ulang sebelum merge.
- Server lokal masih jalan di port 3000 (milik pekerja paralel sekarang);
  saya tidak mematikannya.
