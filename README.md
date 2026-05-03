# QR Order System

QR Order System; restoranların QR menü, masa bazlı sipariş, mutfak ekranı,
garson paneli, adisyon/ödeme, analytics ve super admin yönetimini tek sistemde
toplayan full-stack uygulamadır.

## Canlıya Alma Özeti

## Local Çalıştırma

Backend:

```bash
cd backend
dotnet restore
dotnet ef database update
dotnet run
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Local frontend env dosyası `frontend/.env.development` içindedir:

```text
VITE_API_BASE_URL=http://localhost:5120/api
VITE_SIGNALR_HUB_URL=http://localhost:5120/hubs/orders
VITE_APP_BASE_URL=http://localhost:5174
VITE_DEMO_AUTH_BYPASS=true
```

Backend:

```bash
cd backend
dotnet restore
dotnet ef database update
dotnet publish -c Release -o ./publish
dotnet ./publish/QrOrderSystem.Api.dll
```

Frontend:

```bash
cd frontend
npm ci
cp .env.production.example .env.production
npm run build
```

`frontend/dist` klasörü statik site olarak yayınlanır. React Router kullandığı
için hosting tarafında tüm path'ler `index.html` dosyasına fallback vermelidir.

Production environment değerleri:

```text
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=...;Username=...;Password=...
Jwt__Issuer=QrOrderSystem
Jwt__Audience=QrOrderSystem.Admin
Jwt__Key=<en-az-32-karakter-guclu-secret>
Jwt__ExpiresMinutes=60
Cors__AllowedOrigins__0=https://app.example.com
VITE_API_BASE_URL=https://api.example.com/api
VITE_SIGNALR_HUB_URL=https://api.example.com/hubs/orders
VITE_APP_BASE_URL=https://app.example.com
VITE_DEMO_AUTH_BYPASS=false
```

Production'da backend gizli değerleri `appsettings.Production.json` içine
yazmak yerine environment variable olarak verin. Özellikle
`ConnectionStrings__DefaultConnection` ve `Jwt__Key` zorunludur; JWT key en az
32 karakter olmalıdır. `Cors__AllowedOrigins__0` canlı frontend domaininiz
olmalı, localhost production'da kabul edilmez.

Local demo mod:

```text
VITE_DEMO_AUTH_BYPASS=true
```

Bu değer development/local ortamda aktifken `/admin`, `/waiter`, `/kitchen` ve
`/super-admin` panelleri şifresiz açılır. Frontend ilgili panel için demo
kullanıcısıyla otomatik login olur ve backend API çağrılarında mevcut JWT
akışı kullanılmaya devam eder. Production build'de demo bypass devreye girmez.
Demo kullanıcılar ve `admin123` şifreleri sadece local/development içindir;
production ortamında seed endpointi kapalıdır ve demo hesaplar oluşturulmamalıdır.

Canlı sağlık kontrolü:

```text
GET https://api.example.com/api/health
```

Canlı uygulama linkleri:

```text
Frontend ana sayfa: https://app.example.com/
Giriş: https://app.example.com/login
Restaurant admin: https://app.example.com/admin
Analytics: https://app.example.com/admin/analytics
Kitchen: https://app.example.com/kitchen
Waiter: https://app.example.com/waiter
Super admin: https://app.example.com/super-admin
QR müşteri menüsü: https://app.example.com/customer/r/{restaurantSlug}/table/{tableNumber}
Backend health: https://api.example.com/api/health
SignalR hub: https://api.example.com/hubs/orders
Uploads: https://api.example.com/uploads/restaurants/{restaurantId}/{fileName}
```

## Demo Seed

Development ortamında multi-tenant demo verisi oluşturmak için:

```bash
curl -X POST http://localhost:5120/api/seed/demo
```

Ardından migration uygulanmalıdır:

```bash
cd backend
dotnet ef database update
```

## Test Login Bilgileri

Tüm kullanıcılar için test şifresi: `admin123`

| Rol | E-posta | Panel |
| --- | --- | --- |
| SuperAdmin | `superadmin@qrorder.local` | `/super-admin` |
| RestaurantAdmin | `demo.admin@qrorder.local` | `/admin` |
| Kitchen | `demo.kitchen@qrorder.local` | `/kitchen` |
| Waiter | `demo.waiter@qrorder.local` | `/waiter` |
| Customer | `demo.customer@qrorder.local` | `/menu` |
| RestaurantAdmin | `bistro.admin@qrorder.local` | `/admin` |
| Kitchen | `bistro.kitchen@qrorder.local` | `/kitchen` |
| Waiter | `bistro.waiter@qrorder.local` | `/waiter` |
| Customer | `bistro.customer@qrorder.local` | `/menu` |

QR müşteri akışı public olarak restoran slug + masa numarası üzerinden çalışır.

## Deployment Checklist

- Frontend `npm run lint` ve `npm run build` temiz olmalı.
- Backend `dotnet build` temiz olmalı.
- Production veritabanına `dotnet ef database update` uygulanmalı.
- `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Cors__AllowedOrigins__0`,
  `VITE_API_BASE_URL`, `VITE_SIGNALR_HUB_URL`, `VITE_APP_BASE_URL` gerçek canlı
  domainlerle set edilmeli.
- `VITE_DEMO_AUTH_BYPASS=false` olmalı.
- Static frontend hosting React Router için bütün route'ları `index.html`'e
  fallback etmeli.
- Backend `/uploads` klasörü production ortamında kalıcı disk veya volume
  üzerinde tutulmalı.
- CORS sadece canlı frontend domainlerini içermeli.
- İlk canlı admin/super admin kullanıcıları güvenli şifrelerle manuel
  oluşturulmalı veya güvenli bir migration/seed operasyonuyla eklenmeli.

## Analytics Dashboard

Restaurant Admin analytics ekranı:

```text
http://localhost:5173/admin/analytics
```

Analytics endpointleri:

```text
GET /api/analytics/summary
GET /api/analytics/top-products?from=&to=&limit=5
GET /api/analytics/table-performance?from=&to=
GET /api/analytics/hourly-orders?date=
GET /api/analytics/monthly-sales?year=
```

RestaurantAdmin sadece kendi `restaurantId` verilerini görür. Kitchen ve Waiter
rolleri analytics endpointlerine erişemez. SuperAdmin için `restaurantId` query
parametresi verilmezse sistem geneli, verilirse seçili restoran hesaplanır.

Dashboard metrikleri:

- Bugünkü ciro ve sipariş sayısı
- Açık / ödenmiş adisyon sayısı
- Aktif masa sayısı
- Ortalama sipariş tutarı
- Bu ayki ciro ve sipariş sayısı
- En çok satan ürünler
- Masa performansı
- Saatlik sipariş yoğunluğu
- Aylık satış grafiği

Demo analytics testi için:

```text
demo.admin@qrorder.local / admin123
```

## Adisyon Yazdırma

Admin adisyon kartlarında ve Waiter adisyon modalında `Adisyon Yazdır`
butonu bulunur. Yazdırma `window.print()` ile çalışır; print media sırasında
navbar, sidebar ve aksiyon butonları gizlenir. Çıktıda masa, adisyon ürünleri,
adet, birim fiyat ve toplam bilgilerinin okunabilir kalması hedeflenir.

## Ürün Özelleştirme / Malzeme Çıkarma

Ürünlerde `removableIngredients` alanı desteklenir. Customer ürün detay
popup'ında çıkarılacak malzemeler seçilebilir. Seçimler order item üzerinde
`removedIngredients` olarak saklanır ve note alanından ayrı tutulur. Kitchen,
Waiter ve Admin detaylarında `Çıkarılanlar` metni ayrıca gösterilir.

## Tema ve Logo Yönetimi

Restaurant Admin `Ayarlar` sekmesinden restoran görünümünü yönetebilir:

- Logo URL
- Primary / secondary / accent color
- Menü arka plan rengi
- Buton rengi

Customer QR menüsü restoranın tema renklerini ve logo URL'sini kullanır.

## Masa ve QR Yönetimi

Admin `Masalar / QR Kodlar` sekmesinden masa ekleyebilir, silebilir, QR linki
kopyalayabilir, QR kodu görüntüleyebilir ve indirebilir. Link formatı:

```text
/customer/r/{restaurantSlug}/table/{tableNumber}
```

## Görsel Galerisi

Admin `Görsel Galerisi` sekmesinden restoran bazlı görsel yükleyebilir. Desteklenen
formatlar:

- jpg
- jpeg
- png
- webp

Dosyalar lokal olarak `backend/uploads/restaurants/{restaurantId}` altında
saklanır ve `/uploads/restaurants/{restaurantId}/{file}` URL'sinden servis edilir.
Yüklenen URL ürün formundaki görsel URL alanında kullanılabilir.

## Garson Çağırma

Customer menüsündeki `Call Waiter` butonu gerçek `WaiterCall` kaydı oluşturur.
Aynı masa için pending çağrı varsa yeni kayıt açılmaz ve müşteriye beklemesi
söylenir. Waiter panelinde bekleyen çağrılar listelenir; `Çözüldü` butonu çağrıyı
kapatır.

## Global Bildirim Sistemi

SignalR üzerinden kalıcı bildirimler gönderilir:

- `OrderCreated`
- `OrderUpdated`
- `OrderStatusUpdated`
- `WaiterCallCreated`
- `WaiterCallResolved`
- `PaymentCompleted`
- `NotificationCreated`

Admin, Waiter ve Kitchen panellerinde bildirim merkezi aktiftir. Bildirimler
kullanıcı kapatana kadar ekranda kalır; Customer panelinde yönetim bildirimleri
gösterilmez.
