# Akıllı Defter — Dokunmatik Kalem Destekli PDF & Defter Çizim Uygulaması (PWA)

Dokunmatik bilgisayarlar ve dijital kalem (stylus) için tasarlanmış; özelleştirilebilir renkli defter sayfaları, PDF ve metin belgeleri üzerinde çalışan çevrimdışı Progressive Web App (PWA) uygulamasıdır.

## Özellikler

- **Özelleştirilebilir Renkli Defter:** Mavi Defter dahil 8 hazır tema + sınırsız özel arka plan rengi seçici; düz, çizgili, kareli, noktalı, izometrik ve porte şablonları; çizgi aralığı ve opaklık ayarı; tüm sayfalara tek tıkla uygulama.
- **PDF, Metin & Word Desteği:** `.pdf`, `.txt`, `.md`, `.docx` ve görselleri sürükle-bırak veya panel üzerinden içe aktarma; belge sayfalarının arasına boş/renkli defter sayfası ekleyebilme.
- **Dokunmatik PC & Kalem (Stylus):** W3C Pointer Events (`getCoalescedEvents`, basınç duyarlılığı, kalem arka silgisi desteği), iki parmakla yakınlaştırma/kaydırma ve **Sadece Kalem Modu (Avuç İçi Reddi)**.
- **Çoklu Ön Tanımlı Kalem & Fosforlu Kalem Yuvaları:** 6+ özelleştirilebilir kalem yuvası (Tükenmez, Dolma/Kaligrafi, Kurşun Kalem, Fırça, Kesik Çizgi — `1`–`9` tuşlarıyla hızlı geçiş) ve düz çizgi kilitli 4 fosforlu kalem yuvası.
- **Gelişmiş Çizim & İşaretleme:** 15 hazır geometrik şekil (doğru, oklar, dörtgenler, üçgenler, çokgen, yıldız, açıklama baloncuğu, **Koordinat Düzlemi X-Y**, **Sayı Doğrusu**), **Akıllı Şekil Düzeltme**, **Bölge İşaretleme (otomatik 1-2-3 rozetli)**, **Lazer İşaretçi**, **Odak Perdesi (Spotlight)**, kenara yaslamalı **Cetvel** ve **Açıölçer**.
- **Düzenleme & Dışa Aktarma:** Kement (Lasso) ile seçim/taşıma/boyutlandırma/renk değiştirme, Çizgi & Kısmi Silgi, metin kutusu, yapışkan not, `Ctrl+V` görsel yapıştırma, sınırsız Geri/İleri Al, otomatik çevrimdışı kayıt (IndexedDB), **PDF / PNG / Yedek (.json)** dışa aktarma.
- **Sağ / Sol El Uyumlu:** Üst, sol veya sağ kenara taşınabilen araç çubuğu ve tek tıkla tam ekran odak modu.

## Çalıştırma ve PWA Olarak Kurma

```bash
npm install
npm run dev
```

Üretim derlemesi ve önizleme:

```bash
npm run build
npm run preview
```

Tarayıcıda (Edge veya Chrome) açtıktan sonra adres çubuğundaki **"Uygulama Olarak Yükle"** simgesine (veya sağ alttaki **"Uygulama Olarak Kur (PWA)"** butonuna) tıklayarak Windows masaüstünüze bağımsız pencere uygulaması olarak kurabilirsiniz.
