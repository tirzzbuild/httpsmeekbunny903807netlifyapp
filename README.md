# GameZone · Website Rental PS & Playbook

Website statis (HTML, CSS, JavaScript) untuk rental PS4 **Rp10.000/jam** (main di tempat) dan sewa Playbook **Rp100.000/12 jam** (siap antar). Siap di-deploy ke Netlify tanpa build.

## Isi folder

```
gamezone-rental/
├── index.html        Halaman utama, katalog, harga, dan form booking
├── style.css         Desain gelap + hijau neon, responsif Android, animasi
├── script.js         Pengaturan usaha, pilihan paket, navigasi HP, WhatsApp, QRIS
├── assets/images/
│   ├── logo.svg            Logo lengkap (untuk latar gelap)
│   ├── favicon.svg         Ikon tab browser
│   ├── icon-180.png        Ikon saat situs ditambahkan ke layar utama HP
│   ├── banner-gaming.webp  Foto utama (hero)
│   ├── ps4.webp            Foto PS4
│   ├── playbook.webp       Foto Playbook
│   ├── banner-cta.webp     Gambar latar bagian kontak
│   └── og-image.jpg        Gambar preview saat link dibagikan di WhatsApp
└── README.md
```

## Fitur

- Katalog PS4 dan Playbook dengan foto, label paket, harga, dan tabel harga.
- Form booking: pilih paket, durasi, tanggal dan jam, nama, nomor WhatsApp, serta alamat antar untuk Playbook. Total dihitung otomatis.
- Setelah booking, pelanggan mendapat kode booking, tombol **Kirim via WhatsApp** (pesan sudah terisi lengkap), dan **QRIS dengan nominal otomatis** plus tombol simpan gambar.
- Booking juga tersimpan di dashboard **Netlify Forms** setelah fitur itu diaktifkan (bagian 5).
- Nyaman di HP: menu ringkas, tombol booking melayang di bawah layar, kolom isian besar, animasi halus yang otomatis mati kalau HP memakai mode "kurangi animasi".

## 1. Atur data usaha

Buka `script.js`, lalu ubah bagian `PENGATURAN` di paling atas. Bagian lain tidak perlu disentuh.

| Pengaturan | Isi |
|---|---|
| `namaUsaha` | Nama rental, contoh `'GameZone'` |
| `whatsapp` | Nomor WhatsApp admin, contoh `'081234567890'`. **Wajib diisi** |
| `alamat` | Alamat rental (opsional) |
| `jamBuka` | Jam buka, contoh `'Setiap hari 10.00–23.00'` (opsional) |
| `hargaPS` | Harga PS4 per jam. Bawaan `10000` |
| `hargaPlaybook` | Harga Playbook per 12 jam. Bawaan `100000` |
| `qrisGambar` | Lokasi gambar QRIS. Bawaan `'assets/images/qris.png'` |
| `qrisKode` | Kode teks QRIS (opsional, dipakai menggantikan gambar) |
| `kodeUnik` | `true` untuk menambah angka unik 1–99 ke nominal QRIS |
| `daftarGame` | Game yang tampil di kartu PS4 |

Harga di hero, kartu produk, tabel harga, dan form ikut berubah otomatis.

## 2. Pasang QRIS

1. Simpan gambar **QRIS statis** (yang tanpa nominal) dari aplikasi merchant kamu, misalnya GoPay, DANA, OVO, ShopeePay, atau aplikasi bank.
2. Taruh di folder `assets/images/` dengan nama persis `qris.png`.
3. Deploy, lalu buka `https://alamat-situsmu/#cek-qris`. Pastikan nama merchant yang muncul benar, lalu scan contoh QR Rp1.000 dari HP lain. Nominal Rp1.000 harus muncul otomatis di aplikasi pembayaran.

Kalau gambar tidak terbaca: scan gambar QRIS dengan aplikasi pemindai QR (misalnya Google Lens), salin teksnya yang diawali `000201`, lalu tempel ke `qrisKode` di `script.js`.

Perlu diketahui:

- Website membuat QR berisi nominal dari QRIS statis milikmu, jadi uang tetap masuk ke merchant yang sama.
- Website tidak bisa mengecek pembayaran secara otomatis. Cocokkan bukti bayar dari pelanggan dengan notifikasi di aplikasi merchant.
- Gambar QRIS hanya terbaca saat situs dibuka lewat internet (setelah deploy), bukan saat `index.html` dibuka langsung dari file.

## 3. Ganti foto

Foto bawaan diambil dari desain contoh. Ganti dengan foto unit asli memakai nama file yang sama: `banner-gaming.webp`, `ps4.webp`, `playbook.webp`.

Kalau fotomu berformat `.jpg`, simpan misalnya sebagai `ps4.jpg`, lalu di `index.html` ganti tulisan `ps4.webp` menjadi `ps4.jpg`. Foto mendatar (landscape) paling pas, lebar sekitar 1000–1400 piksel.

## 4. Deploy ke Netlify

1. Buka [app.netlify.com/drop](https://app.netlify.com/drop).
2. Seret folder `gamezone-rental` atau file ZIP-nya ke kotak Drop. Situs langsung online.
3. Login atau daftar untuk mengklaim situs. Sebelum diklaim, situs dikunci password sementara.
4. Ganti nama situs di pengaturan proyek supaya alamatnya mudah diingat, misalnya `gamezone-rental.netlify.app`.
5. Untuk memperbarui situs: di dashboard proyek, seret folder yang sudah diubah ke area **Production deploys**.

Ukuran folder ini jauh di bawah batas deploy Netlify (50 MB).

## 5. Terima booking di dashboard Netlify (disarankan)

1. Di Netlify, buka menu **Forms**, lalu pilih **Enable form detection**.
2. Deploy ulang (seret folder sekali lagi).
3. Setiap booking dari website muncul di **Forms** dengan nama form `booking`: kode, paket, durasi, jadwal, nama, nomor WhatsApp, alamat, catatan, dan total bayar.
4. Supaya dapat email setiap ada booking: **Forms → Submission notifications → Add notification**.

Sejak 14 April 2026, kiriman form di Netlify gratis tanpa batas untuk paket Free berbasis kredit. Akun dengan paket lama (Legacy) mengikuti batas paket lamanya.

## 6. Preview link di WhatsApp

Di `index.html`, ganti `https://gamezone-rental.netlify.app` (ada di `og:url` dan `og:image`) dengan alamat situsmu, lalu deploy ulang. Setelah itu link yang dibagikan di WhatsApp akan tampil dengan gambar `og-image.jpg`.

## Cek sebelum dibagikan

- [ ] Isi form dengan data uji. **Kirim via WhatsApp** membuka chat ke nomor admin.
- [ ] `#cek-qris` menampilkan merchant yang benar, dan contoh Rp1.000 terbaca di aplikasi pembayaran.
- [ ] Booking uji muncul di Netlify Forms.
- [ ] Harga di semua bagian sudah benar.

## Catatan teknis

- Font dimuat dari Google Fonts. Pembuat QR (qrcode-generator) dan pembaca gambar QR (jsQR) dimuat dari jsDelivr hanya saat dibutuhkan.
- Data booking tersimpan di Netlify Forms. Di HP pelanggan hanya tersimpan nama, nomor, dan alamat terakhir supaya form berikutnya terisi otomatis.
