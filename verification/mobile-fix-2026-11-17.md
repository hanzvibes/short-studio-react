# Perbaikan Mobile/Tablet — Short Studio React

**Tanggal:** 17 November 2026 (WIB)
**Implementor:** subagent implementor (hanya `components/Studio.tsx` + `app/globals.css` yang diubah, plus laporan ini dan catatan README)
**Menindaklanjuti:** `verification/mobile-audit-2026-11-17.md` (1 BLOCKER, 1 MAJOR, 10 MINOR)
**Build:** `npm run build` **HIJAU** — Next.js 15.5.29, compiled ~5 dtk, 4/4 static pages, tanpa error/ warning baru. Server lokal di-restart sesudah tiap rebuild (`npm start -- --port 3000`).
**Verifikasi:** Playwright 1.65.1 + `chrome-headless-shell` (SwiftShader), intercept three.js lokal di `/tmp/ss-vendor/` — pola yang sama dengan audit. **0 console error / pageerror / requestfailed di semua run.** Skrip + data mentah: `~/workspace/tmp-audit/verify-fix.mjs`, `verify-fix-part2.mjs`, `probe-tour.mjs`, `probe-save.mjs`, `probe-tilde.mjs`, `verify-fix-results.json`, `verify-fix-part2.json`.

**Hasil ringkas: 12 dari 12 temuan FIXED, 0 tidak diperbaiki.** Satu temuan tambahan di luar daftar audit (dialog tertutup konten workspace) ditemukan saat verifikasi dan ikut diperbaiki — lihat "Temuan tambahan" di bawah.

**Tidak disentuh:** 12 template di `public/templates/` — mtime ke-12 file tetap `2026-11-17 08:19`. Tidak ada commit/push (workdir lokal tidak punya `.git`; urusan repo di tangan koordinator). Perilaku fungsional editor tidak diubah (validasi, Terapkan, simpan video baru, bridge `__st` sama seperti sebelumnya — hanya layout/UX/interaksi).

---

## 1. [BLOCKER] Tab inspector tertutup panel timeline — FIXED

**Akar masalah (terkonfirmasi):** `#timelinePanel` membawa inline `style={{height: tlHeight}}` = 264px, sementara baris grid ke-2 di ≤900px hanya `var(--tl-h)` = 218px. Panel meluber 46px ke baris inspector dan — karena panel `position:relative` sementara `.inspector` statis — mengecat di atas tab.

**Yang diubah — `app/globals.css`:**
- `@media (max-width:900px)`: baris grid `.workspace` dari `max(340px,58dvh) var(--tl-h) auto` menjadi `max(340px,58dvh) auto auto` — tinggi baris mengikuti tinggi panel, jadi panel tidak pernah meluber ke baris lain apa pun nilai `tlHeight`-nya.
- `@media (max-width:600px)`: baris yang sama juga diubah ke `auto auto` — aturan ini menimpa aturan ≤900px (lebih akhir di file) dan sempat membuat perbaikan pertama tidak berpengaruh di 390px; ketahuan saat verifikasi putaran pertama (baris grid masih 218px) lalu diperbaiki.
- `.inspector` di ≤900px diberi `position:relative;z-index:2` sebagai pertahanan lapis kedua.

**Bukti sesudah perbaikan (390 / 768 / 834):**
- Baris grid: `489.5px 264px 334px` (390), `593.9px 264px 334px` (768), `645px 264px 334px` (834) — tumpang tindih timeline↔tab **−5px (tidak ada)**.
- `elementFromPoint` di pusat keempat tab mengembalikan tombol tab itu sendiri di semua lebar.
- Klik mouse asli berpindah tab: `Caption8`, `Props12`, `Shot10`, `Teks` (teks tab aktif).
- Screenshot: `mobile-390-inspector-tabs-after.png`, `mobile-768-inspector-tabs-after.png`, `mobile-834-inspector-tabs-after.png`, `mobile-{390,768,834}-boundary-after.png`.

## 2. [MAJOR] Toolbar timeline meluber 110px di 390px — FIXED

**Akar masalah (terkonfirmasi):** CSS `@media (max-width:600px)` menyembunyikan `#tlZoomOut,#tlZoomIn,#tlZoom`, tetapi ketiga elemen itu tidak punya `id` — selector mati.

**Yang diubah — `components/Studio.tsx:1702-1705`:** tombol zoom out / slider / zoom in / Fit diberi `id="tlZoomOut"`, `id="tlZoom"`, `id="tlZoomIn"`, `id="tlFit"`. Tidak ada perubahan CSS — aturan sembunyi ≤600px yang sudah ada kini berlaku. Sesuai desain yang sudah ada, kontrol zoom memang sengaja disembunyikan ≤600px; fungsi zoom/fit tetap bisa lewat keyboard (`F`) dan palet perintah.

**Bukti sesudah perbaikan (390px):** `.tl-tools` `right=378 ≤ 390`, zoom out/in/slider `display:none`, tombol Fit terlihat 44×44 di `right=378`, `docScrollW=390` (tanpa overflow-x).
Screenshot: `mobile-390-timeline-after.png`.

## 3. [MINOR] Target tap < 44px — FIXED

**Yang diubah — `app/globals.css`, blok baru `@media (pointer:coarse) and (max-width:1180px)`:** `.tb-icon`, `.ph-icon`, `.tbtn`, `.tool`, `.btn`, `.btn.small`, `.play`, `.tab`, `.mi`, `.vzoom` → 44px; `.panel-h` → 44px (supaya `.tool`/`.ph-icon` 44px muat di header 32px); `.mine-h`/`.dlg-h` → 48px (supaya `.btn.small` 44px tidak meluber dari header 30/40px). Blok `pointer:coarse` lama tidak disentuh; desktop fine-pointer (1440px, mouse) tidak berubah.

**Bukti sesudah perbaikan (390px):** menu 44×44, play 44×44, `.tbtn` 44×44, tab 91×44, Terapkan 217×44, tool Fit 44×44, ph-icon 44×44.

**Batasan:** `.trk-mini` (sembunyikan/kunci track) tetap 26px — kepala track hanya 36–60px tingginya sehingga tombol 44px akan meluber; kontrol ini tidak ada di daftar audit dan tetap bisa ditekan.

## 4. [MINOR] Nama track terpotong ("Shots"→"S…") — FIXED

**Yang diubah — `app/globals.css`:** kolom `.tl-body` dilebarkan: 108px → **140px** (≤900px), 92px → **112px** (≤600px), 84px → **100px** (≤400px). Nama track dan kedua tombol mini tetap tampil; hanya area konten timeline yang menyempit sedikit.

**Bukti sesudah perbaikan:** 768px — Shots 51/51, Captions 51/51, Narasi 80/80 (`scrollWidth == clientWidth`; sebelumnya Shots 19 vs 28, Captions 19 vs 43). 834px sama; 390px 69/69 semua. Terlihat di `mobile-768-inspector-tabs-after.png` ("V1 Shots", "T1 Captions", "A1 Narasi" terbaca penuh).

## 5. [MINOR] Tour langkah 1 menunjuk drawer yang tertutup — FIXED

**Yang diubah — `components/Studio.tsx:1209-1275` (`tourPlace`, efek `tourStep`, `endTour`):**
- Langkah 0 kini membuka drawer di **semua** lebar (sebelumnya hanya `>1180px`), dicatat di `tourOpenedDrawerRef`.
- Saat tour lanjut ke langkah berikut / selesai, drawer yang dibuka oleh tour ditutup lagi (hanya bila lebar ≤1180px — di desktop perilaku lama dipertahankan: drawer tetap terbuka).
- Pengukuran ulang sorotan: timeout 320ms + 1000ms + listener `transitionend` sekali pada `#drawer` (timeout 320ms saja terbukti tidak cukup — di headless transisi drawer molor >700ms, lihat catatan di bawah), dan lebar/tinggi sorotan dijepit `≥0` (lebar negatif membuat deklarasi `width` inline tidak valid sehingga sorotan hilang).

**Bukti sesudah perbaikan (390px):** langkah 1 `body=drawer-open`, drawer `x=4 w=278`, sorotan settle `x=4 y=46 w=284 h=772` (drawer + pad 6px); langkah 2 `body=drawer-closed`, "Viewer 9:16". Catatan headless: sorotan terukur `w=0` pada +800ms sesudah kartu muncul (transisi drawer masih berjalan di SwiftShader) dan `w=284` pada +3000ms; di perangkat nyata (transisi 240ms) sorotan settle dalam ~600ms.
Screenshot: `mobile-390-tour-step1-after.png`, `mobile-390-tour-step2-after.png`.

## 6. [MINOR] Transport terpotong di HP landscape — FIXED

**Yang diubah — `app/globals.css`, blok baru `@media (max-width:900px) and (max-height:500px)`:** baris viewer `max(340px,58dvh)` → `max(250px,52dvh)`.

**Bukti sesudah perbaikan (844×390):** transport `y 245–301`, status bar mulai `y=362` — transport muat penuh di lipatan; tombol play 44×44 di `y 252–296`; `docScrollW=844` (tanpa overflow-x). Stage mengecil menjadi 62×110 — trade-off yang diterima (yang diperbaiki adalah keterjangkauan transport, bukan ukuran stage).
Screenshot: `mobile-390-landscape-after.png`.

## 7. [MINOR] ArrowRight saat slider zoom fokus malah seek — FIXED

**Yang diubah — `components/Studio.tsx:1329` (handler keyboard global):** bila fokus sedang di `input[type="range"]`, handler kembali lebih awal — panah/Home/End memakai perilaku native slider. Penempatan sesudah penanganan Ctrl+K / Ctrl+Enter, jadi kedua pintasan itu tetap jalan saat slider fokus.

**Bukti sesudah perbaikan (768px):** fokus `#tlZoom`, tekan ArrowRight → nilai slider `0 → 1`, waktu playhead `0 → 0` (tidak seek).

## 8. [MINOR] Pesan error validasi jauh di bawah daftar — FIXED

**Yang diubah — `components/Studio.tsx:660-684` + `app/globals.css`:**
- Memo baru `capErrByRow` / `shotErrByRow` / `propErrById`: memetakan pesan error ke barisnya dari prefiks `Caption #N:` / `Shot #N:` / `<id prop>:`.
- Baris yang bermasalah mendapat class `err` (border merah, `Studio.tsx:1952, 2018, 2088`) + pesannya dirender tepat di bawah baris itu (`.row-err`, `Studio.tsx:1971, 2040, 2110`). Ringkasan error di bawah daftar tetap ada seperti sebelumnya.
- CSS: `.edit-cap.err,.edit-shot.err{border-color:var(--bad)}`, `.prop-row.err` (label + input merah), `.row-err{margin:0 2px}`.

**Bukti sesudah perbaikan (390px):** caption #1 (mulai 3, selesai 2,5) → baris ber-border merah, pesan inline `"Caption #1: selesai harus sesudah mulai."` tepat di bawah baris, `#apply-cap` disabled.
Screenshot: `mobile-390-caption-invalid-after.png`.

## 9. [MINOR] Sehabis Simpan, drawer tetap tertutup — FIXED

**Yang diubah — `components/Studio.tsx:841-848` (`confirmSaveMine`):** sesudah simpan berhasil, bila lebar ≤1180px drawer dibuka (`setDrawerOpen(true)`) dan item baru di-scroll ke tampilan sesudah 320ms (transisi drawer).

**Bukti sesudah perbaikan (390px):** `body=drawer-open`, item `"Fix 390"` terlihat (`y 701–757`, dalam viewport), toast `"Fix 390" disimpan di Video Buatan Saya`.
Screenshot: `mobile-390-save-after.png`.

## 10. [MINOR] Truncasi kartu drawer — FIXED

**Yang diubah:**
- `app/globals.css`: `.mine-h>span:first-child{white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}` (judul tidak wrap lagi); `.tpl-dur{padding:0 2px 0 6px;white-space:nowrap;flex:0 0 auto}` (ruang napas ekstra untuk glyph `~`).
- `components/Studio.tsx:1569`: label tombol drawer `"+ Simpan saat ini"` → `"+ Simpan"` (tooltip lengkap tidak berubah).

**Bukti sesudah perbaikan (1440px):** "Video Buatan Saya" satu baris (`h=17`, `scrollH=17`, `wrapped=false`), tombol "+ Simpan" 69px. `"~30s"`: span `x=212 w=32`, glyph `~` `x=218 w=6` — sepenuhnya di dalam span; screenshot elemen menunjukkan `"~30s"` utuh. (Catatan: secara geometri `~` sebenarnya tidak pernah terpotong layout — range rect-nya sudah di dalam span sebelum perbaikan; yang tampak pudar adalah render glyph mono 10px di headless. Padding kiri tambahan menghilangkan keraguan.)
Screenshot: `mobile-390-save-after.png` (header "Video Buatan Saya" satu baris), `mobile-1440-tilde-after.png`.

## 11. [MINOR] Stage kecil di tablet landscape — FIXED (naik ~12–14%)

**Yang diubah:**
- `app/globals.css` `@media (max-width:1180px)`: `--tl-h:248px` → **224px** (isi timeline butuh 202px: header 32 + ruler 28 + 60 + 46 + 36 — tersisa 22px, tidak ada yang terpotong).
- `components/Studio.tsx` `fitStage`: `padPx` 22 → **14** bila lebar ≤1180px.

**Bukti sesudah perbaikan:** stage 1024px: 160×285 → **183×325** (+14%); 1180px: 190×337 → **212×377** (+12%). Track audio tidak terpotong (`audioBottom < tlBottom` di kedua lebar).
Screenshot: `mobile-1024-home-after.png`, `mobile-1180-home-after.png`.

## 12. [MINOR] Tombol Terapkan/Reset tanpa id — FIXED

**Yang diubah — `components/Studio.tsx`:** Shot → `id="apply-shot"` / `id="reset-shot"` (`:1980-1981`); Caption → `id="apply-cap"` / `id="reset-cap"` (`:2069-2070`); Props → `id="apply-props"` / `id="reset-props"`. Tab Teks tetap `#apply` / `#reset` seperti sebelumnya.

**Bukti:** keenam id ada di DOM saat tab-nya aktif.

---

## Temuan tambahan (di luar daftar audit, ditemukan saat verifikasi)

**Dialog tertutup konten workspace saat workspace di-scroll — FIXED.**

Saat memverifikasi temuan 9, klik "Simpan video" di dialog gagal (timeout 30 dtk): `elementFromPoint` di tengah tombol mengembalikan `DIV.ruler-ticks`. Penyebab: `<dialog open>` non-modal **tidak masuk top layer**, dan dialog ini diposisikan di `y=0` viewport — konten workspace yang di-scroll (ruler timeline) bisa mengecat di atasnya dan mencegat klik. Struktur ini sudah ada sebelumnya; pelebaran `.panel-h`/`.btn` ke 44px menggeser geometri sehingga tumpang tindih yang di audit hanya lolos tipis (~10–20px, lihat `mobile-390-func-save-dialog.png` — bawah dialog nyaris menyentuh ruler) kini tepat mengenai tombol Simpan pada posisi scroll yang dihasilkan helper `revealTabs` audit sendiri.

**Yang diubah — `app/globals.css:563`:** `dialog { z-index: 80; }` — di atas workspace/drawer (70)/scrim (65), di bawah tour (100)/toast (120). Dialog tetap di `y=0` (tampilan tidak berubah), hanya urutan catnya yang dijamin.

**Bukti:** `elementFromPoint` di tengah tombol kini mengembalikan `BUTTON.btn.primary`; klik mouse asli menyimpan (`"Claude vs Codex" disimpan di Video Buatan Saya`, `body=drawer-open`, dialog tertutup).

---

## Regresi yang diperiksa

- **Desktop 1440px (kontrol):** `body=drawer-open` saat load, drawer terlihat, `docScrollW=1440` (tanpa overflow-x), tab Props bisa diklik mouse (`Props12`), stage 226×401 tidak berubah, slider zoom timeline tetap terlihat. Screenshot: `mobile-1440-home-after.png`.
- **Dua bug drawer lama tidak regresi:** (1) class `body.drawer-open` / `drawer-closed` tetap disinkronkan dari state — tercatat di semua run; (2) drawer default **TERTUTUP** saat load di ≤1180px — terbukti di run tour final (drawer masih di `x=-286` sesaat sesudah kartu tour muncul, lalu beranimasi terbuka karena tour; di 390/768/834/1024/1180 drawer tertutup saat load seperti sebelumnya).
- **Template tidak berubah:** mtime ke-12 file `public/templates/*.html` tetap `2026-11-17 08:19`.
- **File yang diubah:** hanya `components/Studio.tsx` dan `app/globals.css` (+ file `verification/*-after.png` dan laporan ini; catatan README).

## Batasan yang diketahui

- `.trk-mini` (tombol sembunyikan/kunci track) tetap 26px di layar sentuh — kepala track 36–60px tidak muat tombol 44px.
- Sorotan tour langkah 1 di headless baru settle ~3 dtk sesudah kartu muncul (transisi drawer lambat di SwiftShader); di perangkat nyata transisi 240ms sehingga settle dalam ~600ms.
- Kecepatan playback lambat di headless dan stage kadang hitam di screenshot diam adalah artefak SwiftShader yang sudah dicatat audit — bukan bug aplikasi; tidak disentuh.
