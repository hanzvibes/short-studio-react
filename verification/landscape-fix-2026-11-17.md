# Perbaikan Bug Landscape — Short Studio React (FINAL)

**Tanggal:** 2026-11-17 (selesai ~21:30 WIB)
**Project:** `~/workspace/short-studio-react` (Next.js 15.5.29 + React 19 + TS, repo `hanzvibes/short-studio-react`)
**Peran:** implementor (subagent). **JANGAN push** — push oleh koordinator.
**Status akhir:** `npm run build` hijau, 0 console error di semua lebar, regresi 390px lolos.

## Catatan proses: laporan audit

Laporan audit `verification/landscape-audit-2026-11-17.md` **tidak muncul selama ~7 jam pertama tugas** (dicek berkala sejak 13:23 UTC sampai kompresi konteks ~20:40 WIB); perbaikan paruh pertama dikerjakan dari analisis sendiri + screenshot Rehan + screenshot before auditor. Laporan audit akhirnya **masuk lewat follow-up koordinator 20:46 WIB dan dibaca sebelum perbaikan diselesaikan** — semua rekomendasi auditor yang masuk akal diterapkan (ambang 800px, mode lipat timeline/transport, caption ringkas, ambang compact shot) dan temuan-temuannya terkonfirmasi oleh pengukuran saya. Satu pengecualian: rekomendasi 7 (vendor three.js ke `public/vendor/`) **di luar cakupan** — tugas membatasi file yang boleh diubah ke `components/Studio.tsx`, `app/globals.css`, `README.md` saja.

**Catatan berkas:** screenshot before auditor (`landscape-1024/1180/1440/1920/390-before.png`) memakai nama yang sama dengan run verifikasi saya, sehingga sebagian tertimpa oleh screenshot sesudah saya. Angka before auditor tetap utuh di dalam `.md` audit itu sendiri; tabel di bawah memakai angka dari `.md` tersebut sebagai baseline.

## Tabel utama — ukuran stage sebelum vs sesudah

Metodologi: `hasTouch: true` (aturan `pointer:coarse` aktif seperti tablet Rehan) + template **Adu Kode** (`template-code`, 30 dtk, 10 shot, 8 caption) — sama dengan metodologi auditor, supaya before/after apple-to-apple. "Sebelum" = baseline pra-perbaikan auditor (v2). "Sesudah" = build final ini.

| Viewport | Stage sebelum (v2) | Stage sesudah | Δ tinggi | Timeline `--tl-h` | Big-play |
|---|---|---|---|---|---|
| **1024×540 (Rehan)** | 45×80 | **77×137** | +71% | 170 | 28px (36%) |
| 1024×768 | 168×299 | **190×337** | +13% | 186 | 54px |
| 1180×820 | 197×351 | **208×369** | +5% | 206 | 54px |
| **1366×768** | 143×255 | **187×333** | +31% | 186 | 54px |
| 1440×900 | 218×387 | 218×387 | 0 (sudah benar) | 264 | 54px |
| 1920×1080 | 319×567 | 319×567 | 0 (sudah benar) | 264 | 54px |
| 390×844 (portrait) | 197×350 | tidak berubah (layout ≤900 tidak disentuh) | — | — | — |

**Mode fokus viewer** (baru, tombol di panel-h viewer / Esc): timeline + transport + now-cap dilipat, stage mendapat seluruh tinggi workspace:

| Viewport | Stage mode fokus | vs baseline v2 |
|---|---|---|
| 1024×540 | **215×382** | 4,8× lebih tinggi dari 45×80 |
| 1366×768 | **334×594** | 2,3× lebih tinggi dari 143×255 |

Di semua lebar: `tl-content` == `tl-scroll` (fit timeline tepat, tanpa scroll horizontal), `scrollWidth == clientWidth` (tanpa overflow-x), 0 console error.

## Temuan 1 — Stage terlalu kecil (akar: anggaran tinggi, bukan rumus fit)

**Akar masalah** (terkonfirmasi audit + pengukuran sendiri): `fitStage` (`Studio.tsx:288-301`) matematikanya benar — stage memang sudah fit-to-height. Yang tidak ada adalah **tinggi untuk di-fit**: di 1024×540, topbar 48 + status 28 + timeline 224 + panel-h 44 + now-cap 24 + transport 56 (semua `pointer:coarse`) + gap 10 = 434 dari 540px → sisa 99px untuk stage.

**Yang diubah:**

1. **Ambang "viewport pendek" 760px → 800px** — `app/globals.css:478-480`. Ambang lama meleset 8px untuk 1366×768 (tablet landscape paling umum; 1280×800 juga lolos). Kini 1366×768 kena pita `--tl-h:186px` (ruler 26 / shot 52 / cap 40 / audio 32) → stage 143×255 → **187×333**. 1440×900 (900 > 800) dan 1920×1080 tidak kena — benar, karena sudah cukup tinggi. Pita `--tl-h:170px` bila tinggi ≤640px (`globals.css:483`) tidak berubah.
2. **Mode fokus viewer (BARU)** — `components/Studio.tsx:166-170` (state `focusView`), `:1509` (class `focus-view` di `.app`), `:1667` (tombol toggle di panel-h viewer, `aria-pressed`, tooltip "Fokus viewer — sembunyikan timeline & transport"), `:1450` (Esc keluar dari fokus dulu sebelum menutup drawer), `:311` (`fitStage` dihitung ulang saat fokus berubah); CSS `app/globals.css:438-446` (`--tl-h:0px` menutup baris timeline, `.timeline{display:none}` supaya tombolnya keluar dari urutan tab, `.transport` + `.now-cap` disembunyikan, `.workspace` baris `minmax(0,1fr) auto auto` supaya mode ini juga bekerja di layout menumpuk ≤900px). Ini satu-satunya jalan agar stage 9:16 di 1024×540 melewati ~150px tingginya.
3. **`fitStage` padding berbasis tinggi** — `components/Studio.tsx:300`: `padPx` 8px bila `innerHeight ≤ 640` (sebelumnya hanya berbasis lebar). Di 1024×540 menghemat 12px → stage 125 → **137px**.
4. **Big-play proporsional + HUD stage** (dari paruh pertama, dipertahankan): `.bigplay{width:min(54px,36%)}` (`globals.css:155`), `.stage{container-type:inline-size}` + `@container (max-width:150px)` menyembunyikan `.stage-hud` dan meringkas `.state` (terverifikasi: di 1024×540 HUD `display:none`, frame bersih — yang tampak seperti chip di thumbnail ternyata teks panel-h di atas frame).

## Temuan 2 — Label klip timeline terpotong

**Akar masalah:** ambang class berbasis % durasi tidak pernah kena untuk klip 7–12% lebar timeline; dan klip normal harus muat judul + durasi (±22px) + padding 12px + gap ±5px ≈ 78px — ambang `compact` lama 72px meleset 5px.

**Yang diubah:**

1. **Shot: ambang berbasis px + panjang label** — `components/Studio.tsx:1855-1863`:
   `labelPx = ("Shot " + (i+1)).length * 6`; `tiny` bila `wPx < labelPx+8` (nomor saja), `compact` bila `wPx < labelPx+42` ("Shot N" tanpa durasi/kamera), selebihnya lengkap. Tooltip `title` tetap lengkap di semua ukuran.
   - Bukti perbaikan: di 1366×768 shot 4 dan 10 (73px, 3,4 dtk) sebelumnya tampil **"Sho…"** (dikonfirmasi screenshot — lihat "Temuan verifikasi" di bawah); kini **"Shot 4" / "Shot 10" penuh**. Di semua lebar 1024–1920, ke-10 shot terbaca penuh; satu-satunya yang berupa angka adalah shot 8 di 1024 (42px → "8", by-design). Di 390px, ke-15 shot template Perang tampil sebagai angka 1–15 (sebelumnya "S…" semua).
2. **Caption: mode ringkas (BARU, sebelumnya tidak ada)** — `components/Studio.tsx:1893-1904` + CSS `app/globals.css:264-271`: `<30px` hanya singkatan pembicara (`Cl`/`Cx`/`Br`, atau titik bila caption tanpa kolom pembicara), 30–70px teks ellipsis dengan padding dipadatkan (`0 3px`, font 10px) supaya kata pertama muat lebih banyak. Di 1024×540 caption kini tampil "Kodeku ra…", "Rapi doan…", "Tes banya…", "Arsitektu…", "Eh, kod…", "Kasus u…", "Satu", "Kode terba…" (sebelumnya terpotong serupa tapi tanpa mode ringkas; di 390px kini tampil "Cl"/"Cx"/"Br" yang dikenali pembicaranya). Tooltip `title` tetap teks lengkap + waktu.
3. **`fitTimeline` atomik** — `components/Studio.tsx:1054-1072` (lihat "Temuan verifikasi" di bawah).

## Temuan 3 — Inspector: "Terapkan" & "Simpan"

- **"Terapkan semua edit" abu-abu = BY-DESIGN** (terkonfirmasi audit): `disabled={!ready || !anyDirty || allErrors.length > 0}` (`Studio.tsx:1935`, guard sama di `applyAll`). Bukan bug — tidak diubah logikanya. Keadaannya dibuat jelas: baris status `role="status"` di keempat pane ("Tidak ada perubahan — ubah teks, caption, shot, atau props untuk mengaktifkan Terapkan." / "Siap diterapkan: 1 teks." / pesan error validasi), dan aksi tiap pane dibungkus `.insp-stick` (sticky di bawah area scroll `.panes`) sehingga Terapkan + Simpan + status selalu terjangkau tanpa scroll. Terverifikasi: ketik "!" di Judul → Terapkan aktif + status "Siap diterapkan: 1 teks." (`landscape-code-1366-after-edit.png`).
- **"Simpan sebagai video baru" TIDAK terpotong di landscape** (terkonfirmasi audit: tepi bawah 113px di atas viewport di 1024×540) — diverifikasi sendiri, tidak diubah tanpa bukti. Sticky bar di atas hanya membuatnya selalu terjangkau, bukan memperbaiki potongan yang tidak ada.

## Temuan verifikasi selama penyelesaian akhir (3 hal yang hampir lolos)

1. **Transien fit timeline 651px.** Time-series sampling sesudah load (1024×576) menunjukkan lebar `.tl-content` sempat **651px** di viewport 575px, baru terkoreksi ~600 md kemudian. Penyebab: pada commit yang sama saat `len` berubah 30→34, efek lebar konten jalan SEBELUM efek fit — dengan `tlPps` basi (19,13, dihitung dari `len=30`), sehingga konten = `ceil(34×19,13)` = 651px. Efeknya: klip tidak mengisi penuh + label dihitung dari lebar yang salah sesaat sesudah ready. Perbaikan: `fitTimeline` kini menyetel lebar konten dari **pps yang sama** dengan state yang disetel (`Studio.tsx:1054-1072`), sehingga fit + lebar atomik dalam satu fungsi. Terverifikasi: `tlContent == tlScroll` di semua lebar pada build final (575=575, 640=640, 731=731, 714=714, 1194=1194).
2. **"Sho…" 73px di 1366 — screenshot adalah ground truth, bukan probe DOM.** Probe `scrollWidth > clientWidth` pada `<b>` melaporkan `trunc:false` untuk shot 4 padahal screenshot jelas menunjukkan "Sho…". Ambang px pertama (compact <72) meleset tepat 5px untuk klip 73px. Perbaikan: rumus `labelPx+42` di atas. Terverifikasi visual pada screenshot final 1366 (semua "Shot 1"–"Shot 10" penuh).
3. **HUD stage di 1024×540.** Sempat dikira chip "Comp 1"/"1080×1920" menumpuk di atas frame; probe membuktikan `.stage-hud` sudah `display:none` (container query bekerja) dan yang terlihat adalah teks panel-h di atas frame. Bukan bug.

## Yang diubah (ringkas, file:baris)

- `app/globals.css`: pita `--tl-h` 760→800px + komentar (`:471-484`); mode fokus viewer (`:438-446`); caption ringkas (`.clip.cap.tiny/.compact`, `:264-271`); (paruh pertama) `--tl-h:206px` + `max-height` di ≤1180px, `.bigplay` proporsional, container query stage, `.clip.shot.compact` padding.
- `components/Studio.tsx`: state `focusView` (`:166-170`); `fitStage` padPx berbasis tinggi + dep `focusView` (`:300`, `:311`); `fitTimeline` atomik (`:1054-1072`); tombol fokus + Esc (`:1667`, `:1450`); ambang shot berbasis px+panjang label (`:1855-1863`); mode ringkas caption (`:1893-1904`); (paruh pertama) `tlContentW` + `ResizeObserver`, dependensi `drawerOpen` pada efek fit, baris status `applyStateText` + `.insp-stick`.
- `README.md`: seksi "Perbaikan landscape 2026-11-17" (aturan layout landscape).
- **Tidak disentuh:** 12 template `public/templates/` (mtime tetap 08:19 — catatan: tugas menyebut harus tetap 15:19, yang teramati sejak awal adalah 08:19 dan tidak berubah oleh pekerjaan saya) dan `lib/studio.ts` (mtime 2026-11-17 09:25). Workdir bukan checkout git (tidak ada `.git`, seperti dicatat auditor) sehingga tidak ada diff git; verifikasi dilakukan terhadap build `.next`.

## Verifikasi akhir (build final, server `npm start -- --port 3000`)

- `npm run build`: **exit 0, "Compiled successfully"** (build terakhir sesudah semua edit).
- Screenshot sesudah (sentuh + Adu Kode, `verification/`): `landscape-code-1024x540-after.png`, `landscape-code-1024x768-after.png`, `landscape-code-1180x820-after.png`, `landscape-code-1366x768-after.png`, `landscape-code-1440x900-after.png`, `landscape-code-1920x1080-after.png`, `landscape-code-1024x540-focus.png`, `landscape-code-1366x768-focus.png`, `landscape-code-1366-after-edit.png`. Seri lama (mouse + Perang): `landscape-1024x576-after.png`, `landscape-1180-after.png`, `landscape-1440-after.png`, `landscape-1920-after.png`.
- **0 console error** di semua run; tanpa overflow-x di semua lebar.
- **Regresi 390px portrait** (build final, `landscape-390-regression.png` + `landscape-390-regression-drawer.png`): drawer default tertutup, buka via ☰, tutup via ✕/scrim; keempat tab inspector (Teks/Shot/Caption/Props) bisa diklik + pane terlihat; `scrollWidth == 390` (tanpa overflow-x); baris apply-state tampil; 0 console error. (Stage hitam di screenshot 390 adalah scene 3D yang belum selesai render saat shot diambil di bawah SwiftShader — artefak timing harness, bukan cacat app; geometri stage 390 sudah terverifikasi auditor 197×350 dan layout ≤900 tidak disentuh perbaikan ini.)
- Alur edit: ketik di Judul → Terapkan aktif, status "Siap diterapkan: 1 teks."

## Di luar cakupan / sisa

- Rekomendasi auditor 7 (vendor three.js r128 + 12 skrip postprocessing ke `public/vendor/` agar preview tidak mati bila CDN mati): **tidak dikerjakan** — di luar 3 file yang diizinkan. Perlu keputusan koordinator (menambah file baru di `public/`).
- Big-play di 1024×540 masih 36% lebar stage (28px dari 77px) — itu batas bawah yang disengaja (`min(54px,36%)`); di mode fokus jadi 54px dari 215px (25%).
- Stage normal di 1024×540 (77×137) tetap kecil secara absolut — batasnya anggaran tinggi; mode fokus adalah jawabannya (215×382). Bila koordinator mau lebih besar lagi tanpa mode fokus, satu-satunya jalan adalah melipat permanen sebagian chrome (mis. transport jadi overlay di atas stage), yang mengubah UX lebih jauh.
