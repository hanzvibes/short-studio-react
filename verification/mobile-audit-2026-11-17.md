# Audit Mobile/Tablet — Short Studio React

**Tanggal:** 17 November 2026 (WIB)
**Auditor:** subagent audit (hanya audit — tidak ada file kode yang diubah)
**Project:** `~/workspace/short-studio-react` — Next.js 15.5.29 + React 19 + TS
**Server:** `npm start -- --port 3000` (lokal, sudah jalan saat audit)
**Browser:** Playwright 1.65.1 + `chrome-headless-shell` di `~/workspace/claude-vs-codex-video/chrome-headless-shell-linux64/` (bukan `/opt/meta-chromium/chrome`), SwiftShader (`--enable-unsafe-swiftshader`), intercept CDN three.js r128 → `/tmp/ss-vendor/` (pola verifikasi sebelumnya; **file `public/templates/` tidak disentuh — mtime ke-12 template tetap `2026-11-17 08:19:01`**).

## Ringkasan eksekutif

Diuji 6 lebar: **390** (HP portrait), **768** dan **834** (tablet portrait), **1024** dan **1180** (tablet landscape), **1440** (desktop, kontrol regresi). Setiap lebar: load segar (konteks baru, localStorage kosong), tunggu `Preview siap`, ukur overflow + geometri, lalu uji drawer / galeri / viewer / transport / timeline / inspector / palet / tema / tour. Uji fungsional penuh di 390px (pilih template, play/pause/seek, klik klip, edit caption + Terapkan, input tidak valid, Reset, Simpan sebagai video baru + buka lagi, ganti tema, putar layar saat memutar).

| Temuan | Tingkat | Lebar |
|---|---|---|
| 1. Tab inspector tertutup timeline — tidak bisa diketuk sama sekali | **BLOCKER** | 390, 768, 834 |
| 2. Toolbar timeline meluber 110px — Zoom in (+) & Fit tak terjangkau | **MAJOR** | 390 (≤600px) |
| 3. Target tap < 44px di layar sentuh | MINOR | 390, 768, 834 |
| 4. Nama track timeline terpotong ("Shots"→"S…") | MINOR | 768, 834 (≤900px) |
| 5. Tour langkah 1 menunjuk drawer yang tertutup (spot di luar layar) | MINOR | ≤1180px |
| 6. Transport terpotong di tengah saat HP landscape | MINOR | 844×390 |
| 7. ArrowRight saat slider zoom fokus malah seek playhead | MINOR | semua lebar |
| 8. Pesan error validasi caption jauh di bawah daftar (harus scroll) | MINOR | semua lebar |
| 9. Sehabis Simpan, drawer tetap tertutup — item baru tak langsung terlihat | MINOR | semua lebar |
| 10. Truncasi kartu drawer ("~30s" terpotong, "Video Buatan Saya" wrap) | MINOR | 1440 (drawer) |
| 11. Stage 9:16 kecil di tablet landscape (banyak ruang kosong) | MINOR | 1024, 1180 |
| 12. Hanya tombol Terapkan/Reset tab Teks yang punya `id` | MINOR | semua lebar |

**Total: 1 BLOCKER, 1 MAJOR, 10 MINOR. Console error: 0 di semua lebar, semua run** (pageerror / console error / requestfailed kosong).

**Dua bug drawer yang sudah diperbaiki sebelumnya TIDAK regresi:** (1) `body` memakai class `drawer-open`/`drawer-closed` yang disinkronkan dari state — terverifikasi di semua lebar; (2) drawer default **TERTUTUP** saat load awal di ≤1180px (`body=drawer-closed`, drawer di x=-286, opacity 0, visibility hidden) dan **TERBUKA** di 1440px. Tombol ☰ selalu bisa dijangkau (topbar, 40×40 di layar sentuh).

## Metodologi & batasan (baca dulu sebelum menilai temuan)

- **Artefak headless, BUKAN bug — jangan diperbaiki sebagai bug:**
  - *Kecepatan playback:* waktu bridge hanya maju ~0,3 dtk per 2,5 dtk waktu dinding (juga 0,35 dtk per 3 dtk pada verifikasi lama). Ini SwiftShader (render WebGL lambat). State play/pause-nya benar (label `Putar`→`Jeda`, waktu stabil saat jeda). Di perangkat nyata kecepatannya realtime.
  - *Tour muncul lambat di headless:* 15–22 dtk setelah load (template JS lambat di SwiftShader). Di perangkat nyata tour muncul 750 ms setelah `load()` selesai. Yang diuji adalah perilaku tour-nya (kartu muat, tombol jalan), bukan delay-nya.
  - *Stage kadang hitam di screenshot diam:* canvas WebGL sesekali tertangkap hitam setelah interaksi cepat, lalu tampil lagi di screenshot berikutnya (mis. `mobile-390-func-landscape-rotated.png` menampilkan scene + judul edit). Bridge tetap `ok:true` dan waktu tetap jalan. Ini artefak presentasi SwiftShader, bukan bug tema/render.
  - *Timeout klik Playwright:* beberapa klik `locator.click()` timeout pada tahap "waiting for scheduled navigations / element stable" saat halaman sibuk render WebGL — padahal kliknya sudah terkirim dan aksinya terjadi (terbukti dari efeknya: zoom 0→10, fit →0, template berganti). Setiap klaim efek di laporan ini diverifikasi dari **efeknya** (nilai/state/DOM), bukan dari suksesnya klik.
  - *Artefak pengujian saya sendiri (bukan bug aplikasi):* pada run pertama, force-click di **tengah** elemen `.scrim` malah mengklik kartu template di bawah drawer (pusat scrim tertutup drawer) sehingga template sempat berganti ke "trio". Run berikutnya mengklik scrim di titik yang **terlihat** (x = lebar−30) dan perilaku scrim terbukti benar.
- **Satu restart runtime** di tengah audit menghapus `/tmp` (skrip + JSON interim + `/tmp/ss-vendor/`). Vendor three.js diunduh ulang via curl (proxy default; 13 file terverifikasi), server di-restart, dan semua run diulang. Data 390 dari run yang hilang sudah tercetak lengkap di log dan dipakai di sini; semua angka penting lain berasal dari file JSON yang tersimpan di `~/workspace/tmp-audit/` (persisten).
- Data mentah (JSON per run): `~/workspace/tmp-audit/audit2d-results.json`, `audit3-results.json`, `audit3b-results.json`, `audit3c-results.json`, `audit3d-results.json`, `audit3e-results.json`, `audit1440-gap.json`. Skrip audit (bukan kode produk): `~/workspace/tmp-audit/mobile-audit*.mjs`.

## Hasil per lebar (ringkas)

| Lebar | `scrollWidth` vs `innerWidth` | Drawer saat load | Bridge | Console error |
|---|---|---|---|---|
| 390×844 (touch) | 390 = 390 | `drawer-closed` | ok, len 30 | 0 |
| 768×1024 (touch) | 768 = 768 | `drawer-closed` | ok, len 30 | 0 |
| 834×1112 (touch) | 834 = 834 | `drawer-closed` | ok, len 30 | 0 |
| 1024×768 | 1024 = 1024 | `drawer-closed` | ok, len 30 | 0 |
| 1180×820 | 1180 = 1180 | `drawer-closed` | ok, len 30 | 0 |
| 1440×900 (kontrol) | 1440 = 1440 | `drawer-open` | ok, len 30 | 0 |

Tidak ada overflow-x di level dokumen pada lebar mana pun. Overflow yang ada bersifat internal (temuan 1 dan 2).

---

## Temuan

### 1. [BLOCKER] Tab inspector (Teks/Shot/Caption/Props) tertutup panel timeline — tidak bisa diketuk sama sekali di lebar ≤900px

- **Lebar:** 390, 768, 834. **Bukan** di 1024/1180/1440 (di sana tab berfungsi — klik mouse terverifikasi berpindah ke Shot10/Caption8/Props12/Teks).
- **Regresi vs desktop:** Ya — perilaku desktop normal, mobile rusak total untuk fungsi ini.
- **Langkah reproduksi:**
  1. Buka studio di lebar 390 (atau 768/834), tunggu `Preview siap`, lewati tour.
  2. Scroll ke inspector (baris ke-3 di bawah timeline).
  3. Ketuk tab mana pun (mis. `Caption`). Tidak terjadi apa-apa: tab aktif tetap `Teks`.
  4. Scroll workspace ke posisi mana pun (0 / 150 / 200 / 290 / 400) lalu ketuk lagi — tetap tidak berpindah.
- **Bukti:**
  - Geometri terukur (390): timeline `y 546–810` (tinggi 264), inspector `y 768–1098`, baris tab `.tabs` `y 769–816` (tinggi 47). Tumpang tindih **42px**. Grid workspace terukur `489.5px 218px 334px` — baris timeline hanya 218px tetapi panel timeline 264px. (768: timeline `y 650–914`, inspector `y 872–1202`, tab `y 873–920`, grid `593.9px 218px 334px` — sama persis.)
  - `document.elementFromPoint` di pusat tiap tab mengembalikan `DIV.tl-heads` / `DIV.tl-content` (isi timeline), bukan tombol tab — pada `scrollTop` 0 **dan** sesudah scroll (150/200/290/400). Tumpang tindih ini **tidak berubah oleh scroll** karena kedua panel berada dalam satu scroller `.workspace`.
  - Ketuk mouse asli di titik tengah tab `Caption` pada `scrollTop` 0 dan 200: tab aktif tetap `Teks` (di 390 dan 768).
  - Klik Playwright pada keempat tab: timeout di 390/768/834 (`ok:false`, tab aktif tetap `Teks`); berhasil di 1024 (`ok:true` semua).
  - Screenshot: `mobile-768-boundary-crop.png` (crop y 850–1020 dari `mobile-768-home.png`: di bawah timeline langsung tampil field `Judul` — tidak ada baris tab), `mobile-390-overlap-boundary.png`, `mobile-768-overlap-boundary.png`, `mobile-390-home.png`, `mobile-768-home.png`. Pada `mobile-390-inspector-panel-*.png` (4 file) semuanya menampilkan pane Teks yang sama — karena tab tidak pernah berpindah.
- **Akar penyebab (untuk worker):** `tlHeight` state default `264` dipasang sebagai inline `style={{height: tlHeight}}` pada `#timelinePanel` (`components/Studio.tsx:182,1601`). CSS `@media (max-width:900px)` di `app/globals.css` mengatur `--tl-h:218px` dan baris grid ke-2 `var(--tl-h)` = 218px. Panel 264px meluber 46px ke baris inspector. Yang membuat timeline **menang** secara visual: `#timelinePanel` ber-`position:relative` (juga `.tl-content`), sedangkan `.inspector` `position:static` — elemen terposisi mengecat di atas elemen non-posisi dalam stacking context yang sama, tanpa peduli urutan DOM. Perbaikan yang paling tepat: samakan tinggi timeline dengan baris grid di ≤900px (mis. `tlHeight` awal mengikuti `--tl-h`, atau jadikan baris grid `auto`/samakan dengan `tlHeight`), atau beri `.inspector` posisi + z-index di atas timeline. (Catatan: handle resize `.tl-resize` sengaja nonaktif di ≤900px — `if (window.innerWidth <= 900) return` — jadi tinggi timeline tidak bisa diubah pengguna di HP.)
- **Dampak:** Di HP/tablet portrait, **tab `Props` tidak bisa dibuka sama sekali** (tidak ada jalur lain: tidak ada perintah palet, tidak ada shortcut, klik klip hanya mengalihkan ke Shot/Caption). Tab `Teks` hanya aktif saat load; tab `Shot`/`Caption` hanya bisa dibuka tidak langsung dengan mengklik klip di timeline. Artinya seluruh pengeditan inspector di HP praktis lumpuh kecuali lewat klip.
- **Jalur kerja sementara yang terverifikasi:** klik klip shot → tab berpindah ke `Shot10` (t=0.01); klik klip caption → tab berpindah ke `Caption9`. Setelah tab berpindah lewat klip, isi pane-nya bisa diedit normal (temuan: edit caption + Terapkan terverifikasi berfungsi — lihat bagian "Terverifikasi OK").

### 2. [MAJOR] Toolbar timeline meluber 110px ke kanan di 390px — tombol Zoom in (+) dan Fit tidak terjangkau; slider zoom terpotong

- **Lebar:** 390 (≤600px). Di 768/834/1024/1180/1440 toolbar muat penuh.
- **Regresi vs desktop:** Ya — khusus layar kecil.
- **Langkah reproduksi:** buka studio di 390, lihat header timeline kanan atas.
- **Bukti:**
  - Terukur (390): `.tl-tools` `right=500` padahal `innerWidth=390` (meluber 110px); anak-anaknya: `Zoom out` x262–296 (terlihat), slider zoom x299–428 (terpotong 38px di kanan), `Zoom in` x431–465 (seluruhnya di luar layar), `Fit timeline` x466–500 (seluruhnya di luar layar). Semua `display:grid` (tidak `none`).
  - Screenshot: `mobile-390-timeline.png` (terlihat tombol `−` + slider yang ujung kanannya terpotong; tidak ada `+`/Fit), `mobile-390-home.png`.
  - Di 768 toolbar muat (`barRight=756`, zoom-in `right=721`) dan fungsi zoom terverifikasi (0→10).
- **Akar penyebab (untuk worker):** CSS `@media (max-width:600px)` di `app/globals.css` mencoba menyembunyikan kontrol zoom dengan selector `#tlZoomOut,#tlZoomIn,#tlZoom{display:none}` — tetapi **ketiga elemen itu tidak punya `id`** (`components/Studio.tsx:1635-1638`: tombol polos `title="Zoom out"/"Zoom in"` + `<input type="range" aria-label="Zoom timeline">`). Selectornya mati. Di 768 ke atas toolbar muat karena panel cukup lebar; di 390 tidak.
- **Dampak:** pengguna HP tidak bisa menekan Zoom in / Fit dari toolbar. Fungsi zoom/fit sendiri **tidak rusak** — masih bisa lewat keyboard (`F` untuk fit) dan palet perintah (`Fit timeline`, terverifikasi ada di daftar palet). Karena ada jalur alternatif, ini MAJOR bukan BLOCKER. Perbaikan: beri `id` pada ketiga elemen sesuai CSS, atau sembunyikan via class, atau buat `.tl-tools` bisa wrap/scroll horizontal di ≤600px.

### 3. [MINOR] Target tap di bawah 44px di layar sentuh

- **Lebar:** 390, 768, 834 (mode `pointer:coarse` + `hasTouch`).
- **Khusus mobile:** Ya (di 1024/1180/1440 tanpa sentuh, ukuran 28/30/26px memang ukuran mouse).
- **Bukti (terukur):** tombol menu 40×40, tombol transport `.tbtn` 38×38, tombol play 42×42, tab inspector 36 tinggi (390) / 36 (768/834), tombol `Terapkan`/`Kembalikan` 38 tinggi, tombol `.tool` timeline 34×34. (CSS `@media (pointer:coarse)` sudah membesarkan sebagian — mis. `.tb-icon` 40px — tetapi belum mencapai 44px.)
- **Catatan:** masih lolos batas minimum WCAG 2.2 (24×24px), tetapi di bawah panduan 44pt Apple / pedoman Material. Semua tombol tetap bisa ditekan (tidak ada yang gagal klik karena ukuran). Perbaikan: naikkan `.tb-icon`/`.tbtn`/`.tab`/`.btn` ke ≥44px pada `pointer:coarse`.

### 4. [MINOR] Nama track timeline terpotong di ≤900px

- **Lebar:** 768, 834 (juga 390 — kolom lebih sempit lagi: 92px/84px).
- **Bukti:** screenshot `mobile-768-home.png` dan `mobile-390-home.png`: header track menampilkan `V1 S…` (harusnya "Shots") dan `T1 C…` (harusnya "Captions"). Penyebab: `.tl-body{grid-template-columns:108px …}` di ≤900px (92px di ≤600px, 84px di ≤400px) — kolom tidak muat badge + nama + 2 tombol mini.
- **Dampak:** kosmetik — badge V1/T1/A1 tetap terbaca. Perbaikan: sembunyikan `.trk-name` atau kecilkan di ≤900px, atau lebarkan kolom.

### 5. [MINOR] Tour langkah 1 menunjuk drawer yang tertutup (spot di luar layar)

- **Lebar:** ≤1180px (drawer tertutup saat load).
- **Bukti:** `mobile-390-tour.png` (langkah 1 "Project bin"): kartu tour tampil rapi dan muat (`x10 y347 w330`, `right=340 < 390`), tetapi sorotan (`.tour-spot`) menunjuk `#drawer` yang sedang off-canvas (x=-286) — pengguna melihat kartu yang menunjuk ke panel yang tidak ada. Langkah 2–5 terverifikasi muat di 390 (`mobile-390-tour-step1..5.png`: semua kartu `right ≤ 380`, langkah 5 "Perintah cepat" `y62–235`). Di 768/834 tour juga tampil dan bisa dilewati (`mobile-768-tour.png`, `mobile-834-tour.png`).
- **Perbaikan:** pada langkah 1 di layar sempit, buka dulu drawer-nya (atau sorot tombol ☰ sebagai gantinya).

### 6. [MINOR] Transport terpotong di tengah saat HP landscape (844×390)

- **Lebar:** 844×390 (rotate dari 390×844 saat video diputar).
- **Bukti:** `mobile-390-func-landscape-rotated.png` — baris transport hanya terlihat setengah di lipatan bawah (tombol play terpotong horizontal); timeline sepenuhnya di bawah lipatan. Penyebab: baris viewer `max(340px,58dvh)` = 340px, sedangkan ruang workspace hanya 314px (390 − topbar 48 − status 28). Pengguna harus scroll untuk melihat transport penuh.
- **Tidak ada kerusakan lain:** tidak crash, video tetap memutar (label `Jeda`, waktu 1,2→1,6 — lambat karena SwiftShader, lihat batasan), tidak ada overflow-x (`docScrollW=844=innerW`), stage muat (119×212 di x363). Kembali ke portrait: tetap memutar, tidak ada overflow. Perbaikan: di viewport pendek (mis. `max-height:500px`), kecilkan baris viewer agar transport muat di lipatan.

### 7. [MINOR] ArrowRight saat slider zoom fokus malah men-seek playhead

- **Lebar:** semua (diuji di 768).
- **Bukti:** slider zoom fokus (`document.activeElement` = `Zoom timeline`), tekan ArrowRight → nilai slider tetap `0`, waktu playhead `0→1` (seek 1 detik).
- **Akar penyebab:** handler keyboard global mengecualikan input `range` dari definisi "typing" (`components/Studio.tsx:1241-1244`), lalu cabang ArrowRight melakukan `preventDefault()` + `goTo(t+1)` (`:1280-1284`) — `preventDefault` mematikan perilaku native slider. Ini kemungkinan disengaja (panah = seek), tetapi membuat slider tidak bisa diatur lewat keyboard sama sekali. Perbaikan: bila `document.activeElement` adalah slider zoom, biarkan perilaku native (jangan `preventDefault`/seek).

### 8. [MINOR] Pesan error validasi caption jauh di bawah daftar (harus scroll)

- **Lebar:** semua (diuji di 390).
- **Bukti:** `mobile-390-func-caption-invalid.png` — baris caption #1 menampilkan nilai tidak valid (mulai 3, selesai 2,5) tetapi pesan error tidak terlihat di viewport; secara DOM error ada (`.valid-err`: `"Caption #1: selesai harus sesudah mulai."`) dan tombol Terapkan disabled (terverifikasi). Pesan dirender di bawah seluruh daftar caption + `<details>` VO. Baris yang salah juga tidak ditandai merah secara visual (hanya ter-select biru).
- **Perbaikan:** tampilkan pesan error di dekat baris yang bersangkutan, atau auto-scroll ke `.valid-err` saat muncul.

### 9. [MINOR] Sehabis "Simpan sebagai video baru", drawer tetap tertutup — item baru tak langsung terlihat

- **Lebar:** semua (diuji di 390).
- **Bukti:** setelah simpan berhasil (toast `"Audit 390" disimpan di Video Buatan Saya`, item ada di `.mine-list`), `body.className` tetap `drawer-closed`. Pengguna di HP harus menekan ☰ dulu untuk melihat hasilnya. Perbaikan: buka drawer (atau tampilkan konfirmasi dengan tombol "Lihat") setelah simpan berhasil.

### 10. [MINOR] Truncasi kartu drawer di 1440

- **Lebar:** 1440 (drawer terbuka).
- **Bukti:** `mobile-1440-home.png` — durasi template "Mengetik (Claude × Remotion)" tampil `~30s` dengan karakter `~` setengah terpotong di tepi kartu; header seksi `Video Buatan Saya` wrap menjadi dua baris ("Video Buatan / Saya"). Kosmetik.

### 11. [MINOR] Stage 9:16 kecil di tablet landscape (banyak ruang kosong)

- **Lebar:** 1024 (stage 160×285 di panel viewer 709 lebar), 1180 (190×337 di panel 865 lebar); 1440: 226×401.
- **Bukti:** `mobile-1024-home.png`, `mobile-1180-home.png` — stage terpusat dengan area kosong besar di kiri-kanan. Ini konsekuensi 9:16 di panel landscape dan kontrol zoom viewer (`Fit`/50%/75%) tersedia sebagai mitigasi, jadi ini catatan polish, bukan cacat: pertimbangkan default zoom yang lebih besar di tablet landscape.

### 12. [MINOR] Hanya tombol Terapkan/Reset tab Teks yang punya `id`

- **Lebar:** semua.
- **Bukti:** `#apply`/`#reset` hanya ada di pane Teks (`components/Studio.tsx:1816,1820`). Pane Shot/Caption/Props punya tombol "Terapkan semua edit"/"Kembalikan" sendiri tanpa `id` (`:1909-1910, :1995-1996, :2054-2055`). Tidak berdampak ke pengguna; berdampak ke testability/automation. Saran: beri `id` yang sama polanya (atau `data-action`) di semua pane.

---

## Terverifikasi OK (tidak ada temuan)

- **Drawer (dua bug lama tidak regresi):** tertutup saat load di 390/768/834/1024/1180 (`body=drawer-closed`, x=-286, opacity 0, visibility hidden); terbuka di 1440 (`body=drawer-open`, terlihat). ☰ membuka (drawer x=4/5, opacity 1), ✕ menutup, **scrim menutup** (klik di area redup x=lebar−30 → `drawer-closed`, rect kembali x=-286/opacity 0/visibility hidden, template tetap "Adu Kode"), buka-tutup 3× berurutan stabil (`drawer-open,drawer-closed ×3`). Tombol ☰ selalu terjangkau (topbar).
- **Galeri:** 12 template; pencarian `code` → 2 hasil ("Adu Kode", "Claude vs Codex vs Gemini"); `zzz-tidak-ada` → 0 + teks `Tidak ada template yang cocok.`; kartu tidak terpotong (`mobile-390-drawer-open.png`, `mobile-390-drawer-search.png`).
- **Viewer 9:16:** muat di semua lebar, `Preview siap`, bridge `__st.ok()=true`, `len` benar (30 untuk code, 32 untuk trio); tidak ada overflow-x dokumen; video tidak tertutup panel lain.
- **Transport:** semua tombol bisa ditekan — Play mengubah label `Putar`→`Jeda` dan waktu maju; Pause membuat waktu stabil (1,0→1,0); klik ruler di tengah → waktu 1,0→15,6 (timecode `00:00:15:35/00:00:32:00`); `−1f`/`+1f` tampil; `−5s`/`+5s` sengaja disembunyikan di ≤600px (desain).
- **Timeline:** klip shot bisa diklik (tab berpindah ke `Shot10`, t=0,01); klip caption bisa diklik (tab `Caption9`); ruler/klip/playhead terlihat; zoom in berfungsi di 768/1024/1180 (slider 0→10); Fit mengembalikan ke 0. (Zoom in/Fit di 390 tak terjangkau — temuan 2.)
- **Inspector:** keempat pane me-render dan field-nya terbaca (Teks: Judul/Subjudul/End card + hitungan karakter; Caption: teks + angka mulai/selesai + dropdown speaker; Shot/Props terverifikasi lewat klik tab langsung di 1024/1180/1440 dan lewat klip di ≤900). Edit caption + Terapkan **mengubah preview**: `caps()[0][2]` menjadi `"AUDIT UBAH TEKS"`, toast `Semua edit diterapkan`, bar now-caption menampilkan `AUDIT UBAH TEKS` pada 0:03 (`mobile-390-func-caption-preview.png`). Input tidak valid (selesai 2,5 < mulai 3) **ditolak dengan pesan jelas** + Terapkan disabled (temuan 8 soal penempatan pesan). Reset mengembalikan teks asli (bridge + input kembali ke `Santai. Kodeku rapi, bug pun minder!`).
- **Simpan sebagai video baru:** dialog muat (`Nama video`, `Simpan video`/`Batal`), tersimpan (`Audit 390 dari trio · 17 Nov`, toast konfirmasi), dibuka lagi (dokumen trio, field judul `Audit 390 Judul` lestari) — `mobile-390-func-save-dialog.png`, `mobile-390-func-save-done.png`, `mobile-390-func-reopened-mine.png`.
- **Menu bar / palet / tour / tema / toast / status bar:** menubar tampil di 1440 (File/Edit/Komposisi/Tampilan/Bantuan), sengaja disembunyikan ≤1180 (diganti palet). Palet Ctrl+K terbuka di semua lebar (390: x10 w370, 42 item; 1440: x440 w560, 42 item), filter `tema` → 1 item, Esc menutup. Tour 5 langkah: semua kartu muat di 390, tombol `Lewati`/`Lanjut` jalan. Tema terang/gelap berfungsi via tombol (≥768) dan via palet (390); tampilan terang terbaca (`mobile-390-func-theme-light.png`, `mobile-1440-theme-light.png`). Status bar menampilkan `Preview siap` + `12 template · 0:30 · 10 shot · 8 caption` (bagian tengah disembunyikan ≤600px sesuai desain).
- **Putar layar saat memutar:** tidak crash, tetap memutar, tidak ada overflow di kedua orientasi (temuan 6 hanya soal lipatan).
- **Tap target utama yang lolos 44px:** tidak ada yang ≥44 kecuali play 42 — lihat temuan 3 (semuanya 34–42px).

## Ringkasan prioritas untuk worker implementasi

Urut dari yang paling parah. Temuan 1 adalah satu-satunya yang membuat fitur tidak bisa dipakai sama sekali di HP.

1. **[BLOCKER — Temuan 1] Samakan tinggi timeline dengan baris grid-nya di ≤900px** (atau beri `.inspector` posisi/z-index di atas timeline). Target: `.tabs` harus bisa diketuk di 390/768/834 pada `scrollTop` berapa pun. Uji ulang: `elementFromPoint` di pusat tiap tab harus mengembalikan tombol tab itu sendiri; klik keempat tab harus berpindah; screenshot batas timeline/inspector di 390 dan 768.
2. **[MAJOR — Temuan 2] Perbaiki selector penyembunyian zoom timeline di ≤600px** — beri `id="tlZoomOut"/"tlZoomIn"/"tlZoom"` pada ketiga elemen (`Studio.tsx:1635-1638`) atau sembunyikan via class; pastikan `Zoom in` dan `Fit` terlihat & bisa ditekan di 390 (kanan `.tl-tools ≤ 390`). Alternatif: izinkan `.tl-tools` wrap.
3. **[MINOR — Temuan 3] Naikkan target tap `pointer:coarse` ke ≥44px** (menu, `.tbtn`, `.tab`, `.btn`, `.tool`).
4. **[MINOR — Temuan 5] Tour langkah 1:** buka drawer dulu (atau sorot tombol ☰) bila lebar ≤1180.
5. **[MINOR — Temuan 4] Nama track:** sembunyikan `.trk-name` di ≤900px atau lebarkan kolom `.tl-body`.
6. **[MINOR — Temuan 6] Viewport pendek (landscape HP):** kecilkan baris viewer agar transport muat di lipatan awal.
7. **[MINOR — Temuan 7] ArrowRight di slider zoom:** jangan `preventDefault`/seek saat fokus di input range.
8. **[MINOR — Temuan 8] Error validasi:** tampilkan di dekat baris yang salah / auto-scroll ke `.valid-err`.
9. **[MINOR — Temuan 9] Setelah simpan:** buka drawer (atau tampilkan tautan "Lihat") agar item baru terlihat.
10. **[MINOR — Temuan 10–12]** Truncasi kartu drawer; stage kecil di landscape (pertimbangkan zoom default); beri `id`/`data-action` pada tombol Terapkan/Reset semua pane.

## Lampiran — screenshot (75 file di `verification/`)

Satu screenshot penuh per lebar: `mobile-390-home.png`, `mobile-768-home.png`, `mobile-834-home.png`, `mobile-1024-home.png`, `mobile-1180-home.png`, `mobile-1440-home.png`.
Per temuan: `mobile-390-drawer-open.png`, `mobile-390-drawer-search.png`, `mobile-390-timeline.png`, `mobile-390-overlap-boundary.png`, `mobile-768-overlap-boundary.png`, `mobile-768-boundary-crop.png` (bukti temuan 1), `mobile-390-tour.png`, `mobile-390-tour-step1..5.png`, `mobile-390-palette.png`, `mobile-390-inspector-panel-teks/shot/caption/props.png`, `mobile-768-inspector-panel-*.png`, `mobile-834-inspector-panel-*.png`, `mobile-390-func-template-trio.png`, `mobile-390-func-playing.png`, `mobile-390-func-caption-applied.png`, `mobile-390-func-caption-preview.png`, `mobile-390-func-caption-invalid.png`, `mobile-390-func-save-dialog.png`, `mobile-390-func-save-done.png`, `mobile-390-func-reopened-mine.png`, `mobile-390-func-theme-light.png`, `mobile-390-func-landscape-rotated.png`, `mobile-390-func-back-portrait.png`, plus `mobile-{768,834,1024,1180,1440}-drawer-open.png`, `mobile-{768,834,1024,1180,1440}-drawer-after-scrim.png`, `mobile-{768,834,1024,1180,1440}-palette.png`, `mobile-{768,834,1024,1180,1440}-theme-light.png`, `mobile-{390,768,834}-tour-done.png`, `mobile-390-theme-light.png`. (File lama `mobile-390-inspector-{teks,shot,caption,props}.png` dan `mobile-768-inspector-{...}.png` adalah screenshot viewport dari run awal — tidak menampilkan inspector karena tab tak bisa diklik; gunakan versi `inspector-panel-*` sebagai gantinya.)
