# NADITOWN — Adaptive Township Emergency Operating System
> **Sime Darby Property University Hackathon 2026**  
> **Tema:** *People and Planet*  
> **Kategori:** Smart Township / Emergency Coordination / Sustainability  
> **Lokasi Prototaip:** Bandar Elmina (City of Elmina), Shah Alam, Selangor

---

## 👥 Agihan Tugasan Prototaip Pasukan

| Ahli | Nama | Tanggungjawab Prototaip | Status |
| :--- | :--- | :--- | :--- |
| **Ahli 1** | **Salman (Anda)** | **Peta Utama & User Interface (UI)** | **Selesai (Siap Sepenuhnya)** |
| **Ahli 2** | **Ana** | Paparan Dashboard (Status Fasiliti & Senarai Sumber) | *Slot Modular Sedia (`src/store.js` & `pane-dashboard`)* |
| **Ahli 3** | **Aufa** | Butang Kawalan Simulasi (Tutup Jalan / Kenaikan Air) | *Slot Modular Sedia (`pane-simulation` & State trigger)* |
| **Ahli 4** | *-* | Backend & Logik Laluan (Routing Algorithm A* / Dijkstra) | *Slot Modular Sedia (`pane-routing` & Map polyline)* |
| **Ahli 5** | **Piqa** | Masukkan Data (20-50 bangunan/jalan) & Testing Sistem | *Slot Modular Sedia (`src/data.js` & `pane-data-test`)* |

---

## 🚀 Ciri-Ciri Utama Yang Telah Dibina (Bahagian Salman)

### 1. Peta Utama Geografikal (Interactive GIS Engine - Leaflet.js)
- **Koordinat Pusat:** Bandar Elmina, Shah Alam (`[3.1835, 101.5080]`).
- **Pelbagai Gaya Peta (Map Styles):**
  - **Tactical Dark Mode (Default):** Paparan pusat kawalan kecemasan berprofil tinggi (CartoDB Dark Matter).
  - **Peta Jalan (Day/Detail):** CartoDB Voyager.
  - **Satelit:** Esri World Imagery resolusi tinggi.
- **Lapisan Poligon Zon Banjir:** Zon Merah (Limpahan Sungai Buloh), Zon Jingga (Tasik Elmina), dan Zon Kuning (Denai Alam) dengan ketelusan (opacity) dan tooltip taktikal.
- **Rangkaian Jalan & Status Sekatan:** Polylines jalan raya berkod warna (*Hijau: Boleh Dilalui*, *Kuning: Air Bertakung*, *Merah: Jalan Terputus*).
- **Marker Khusus Beranimasi (Custom SVG DivIcons):**
  - 🏠 Pusat Pemindahan Sementara (PPS) dengan indikator muatan & kapasiti dihuni.
  - 🏥 Fasiliti Kesihatan / Hospital & Pusat Triage.
  - 🚒 Balai Bomba, Penyelamat (JBPM), PKOB & Depot Logistik Sime Darby.
  - 📡 Telemetri Sensor Paras Air IoT dengan *pulse ring* amaran dan tolok bacaan masa nyata.
- **Pop-up Kaca Taktikal (Glassmorphism Popups):** Memaparkan maklumat fasiliti, bar peratusan kapasiti, nama pegawai dihubungi, dan butang tindakan pantas.

### 2. Antaramuka Pengguna (UI Command Center Architecture)
- **Top Command Header:**
  - Penjenamaan rasmi NADITOWN + Sime Darby Property University Hackathon 2026.
  - Penunjuk Tahap Kecemasan Dinamik (`KOD KUNING`, `KOD JINGGA`, `KOD MERAH`).
  - Jam Masa Nyata Malaysia (`MYT`).
  - Modal Maklumat Struktur Pasukan yang interaktif.
- **Modular Collapsible Sidebar:**
  - Butang tarik/sorok sidebar secara lancar (`invalidateSize` auto-trigger pada peta).
  - 5 Tab khusus untuk setiap ahli kumpulan bersambung ke central reactive store (`src/store.js`).
- **Pintasan Navigasi & Carian:**
  - Carian pantas nama bangunan/fasiliti pada peta.
  - Pintasan ke Dewan Komuniti Elmina West, Rainbow Bridge, Jambatan Sg. Buloh, dan Klinik Denai Alam.
- **Alert Ticker Footer:** Ticker berita simulasi kecemasan langsung di bahagian bawah skrin.

---

## 🛠️ Cara Menjalankan Prototaip Secara Tempatan

```bash
# 1. Pastikan anda berada dalam direktori projek
cd "c:\VS Code\naditown-prototype"

# 2. Pasang kebergantungan (jika belum)
npm install

# 3. Jalankan pelayan pembangunan tempatan (Vite)
npm run dev

# 4. Buka pelayar web di:
http://localhost:5173/
```

---

## 📂 Struktur Fail Projek

```
naditown-prototype/
├── index.html         # Shell UI utama, antaramuka header, map container, sidebar tabs
├── package.json       # Konfigurasi projek Vite, Leaflet, dan Lucide
├── src/
│   ├── main.js        # Entrypoint aplikasi (bootstrap map + UI)
│   ├── map.js         # Engine Peta Utama Leaflet (Ahli 1: Salman)
│   ├── styles.css     # Sistem Rekaan Taktikal, Glassmorphism, & Animasi Pulse
│   ├── data.js        # Dataset perbandaran Bandar Elmina (Fasiliti, Jalan, Sensor, Zon)
│   ├── store.js       # Pengurus State Reaktif (Hubungan antara Salman, Ana, Aufa, Ahli 4, Piqa)
│   └── ui.js          # Pengawal interaksi UI, suis layer, modal, dan tab ahli
└── dist/              # Bundle sedia untuk produksi (npm run build)
```

---

## 🤝 Panduan Integrasi Untuk Rakan Kumpulan Anda

- **Untuk Ana (Ahli 2 - Dashboard):**
  Edit `src/ui.js` fungsi `setupDashboardTab()` atau masukkan kad analitik tambahan ke dalam `#pane-dashboard` dalam `index.html`.
- **Untuk Aufa (Ahli 3 - Kawalan Simulasi):**
  Gunakan fungsi `store.setRoadStatus(roadId, 'closed')` dan `store.setEmergencyLevel('RED')` untuk mengubah paparan jalan dan status amaran pada peta.
- **Untuk Ahli 4 (Routing Engine):**
  Panggil fungsi `mapEngine.drawEvacuationRoute(coordinatesArray)` untuk memaparkan garis panduan laluan alternatif beranimasi di atas peta.
- **Untuk Piqa (Ahli 5 - Data & Testing):**
  Tambahkan rekod bangunan/jalan baharu di `src/data.js` atau gunakan `store.addFacility(...)` untuk demonstrasi ujian langsung.