# Literature Hub

Araştırma grubunun ortak makale havuzu. Makaleleri Google Drive'da PDF olarak depolar, Supabase/Postgres'te metadata (alan, etiket, proje referansları) tutar.

**Canlı:** [literature-hub-amber.vercel.app](https://literature-hub-amber.vercel.app)

## Genel Bakış

- **Havuz (Pool)**: Tüm makaleler alan bazlı Drive klasör hiyerarşisinde saklanır.
- **Projeler**: Havuzdaki makalelere referans veren koleksiyonlar. Dosya kopyalanmaz.
- **Alanlar**: Drive klasörlerine 1:1 eşlenen hiyerarşi (Ana Alan → Alt Alan).
- **Etiketler**: Çok boyutlu sınıflandırma; bir makale birden fazla etiketle işaretlenebilir.
- **Kuruluşlar**: Makalelere kuruluş/üniversite bilgisi eklenebilir; filtrele ve listede görüntüle.
- **Yazarlar**: Makale yazar bilgisi ayrı alan olarak saklanır.
- **Git Repo**: Makaleye ilişkilendirilmiş kaynak kodu deposu için Git repo URL alanı.
- **Yorumlar**: Her makale detay sayfasında yorum yapılabilir; yorum sayısı liste görünümünde rozet olarak gösterilir.

## Arayüz Özellikleri

- **Responsive tasarım**: Mobilde kart görünümü, masaüstünde tablo görünümü.
- **Tooltip**: Tüm ikon butonların üzerine gelindiğinde açıklama gösterilir (klavye erişilebilir).
- **İki aşamalı silme**: Makale silme işlemi ikinci bir onay adımı gerektirir; geri alınamaz işlem uyarısı gösterilir.
- **Proje sayacı**: Makalenin kaç projede yer aldığı liste görünümünde rozet olarak gösterilir.
- **PWA**: Tarayıcıdan masaüstüne veya ana ekrana yüklenebilir (Progressive Web App desteği).

## Kurulum

### 1. Bağımlılıkları yükle

```bash
npm install
```

### 2. Ortam değişkenlerini ayarla

```bash
cp .env.example .env.local
```

`.env.local` dosyasını doldurun (aşağıdaki bölümlere bakın).

### 3. Geliştirme sunucusunu başlat

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresinden erişin.

---

## Google Cloud Kurulumu

### OAuth 2.0 + Drive API

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Library** → **Google Drive API** → Enable.
2. **APIs & Services → OAuth consent screen** → External → uygulama adı, support e-posta doldurun → **Scopes** ekle:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive`
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (ve production URL'nizi ekleyin)
4. `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini kopyalayın.

### Drive Kök Klasörü

1. Google Drive'da araştırma grubu için paylaşılan bir klasör oluşturun.
2. Klasörü grubun tüm üyeleriyle paylaşın.
3. Klasörün URL'sindeki ID'yi kopyalayın:
   `https://drive.google.com/drive/folders/**<BURAYA_ID>**`
4. `DRIVE_ROOT_FOLDER_ID` değişkenine atayın.

---

## Supabase Kurulumu

1. [supabase.com](https://supabase.com) → yeni proje oluşturun.
2. **SQL Editor** → `supabase/migrations/001_initial.sql` içeriğini yapıştırıp çalıştırın.
3. **Project Settings → API** sayfasından:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon / public key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (gizli tutun!)

---

## Ortam Değişkenleri

```env
GOOGLE_CLIENT_ID=           # Google Cloud OAuth client ID
GOOGLE_CLIENT_SECRET=       # Google Cloud OAuth client secret
NEXTAUTH_SECRET=            # openssl rand -base64 32
NEXTAUTH_URL=               # http://localhost:3000 (production'da tam URL)
DRIVE_ROOT_FOLDER_ID=       # Paylaşılan Drive kök klasörünün ID'si
NEXT_PUBLIC_SUPABASE_URL=   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key (sunucu taraflı)
```

---

## Vercel'e Deploy

1. GitHub'a push edin.
2. [vercel.com](https://vercel.com) → **Add New Project** → repoyu seçin.
3. **Environment Variables** bölümünde `.env.local` değerlerini tek tek girin.
4. Google Cloud Console'da Authorized Redirect URI olarak `https://<your-domain>/api/auth/callback/google` ekleyin.
5. `NEXTAUTH_URL` değişkenini production URL'niz ile güncelleyin.

> **Not — Dosya boyutu sınırı:** Vercel Hobby tier'da request body 4.5 MB ile sınırlıdır. Büyük PDF'ler için Vercel Pro veya `NEXT_BODY_SIZE_LIMIT` ayarı gerekebilir.

---

## Alternatif: Google Sheets Metadata Deposu

Supabase yerine Google Sheets + Sheets API kullanılabilir:
- Sıfır ek altyapı
- Ancak etiketler ve projeler gibi ilişkisel veriler için daha az uygun
- Küçük gruplar için (`<200 makale`) geçerli bir seçenek

Bu README varsayılan olarak Supabase'i anlatır. Sheets alternatifi ileriki bir geliştirme olarak değerlendirilebilir.

---

## Roadmap

Şu an gerçekleştirilmemiş, ancak veri modeli değişikliği gerektirmeyen özellikler:

- **Gemini/LLM Analizi**: Seçili makale kümesi üzerinde literatür analizi.
- **Toplu İndirme**: Proje/filtre sonuçlarını yerel çevrimdışı inceleme için ZIP olarak indirme.
- **Çalışma Grubu Notları**: Aylık toplantı notları ve alan yönelim katmanı.
