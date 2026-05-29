import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Gizlilik Politikasi - Literature Hub",
  description: "Literature Hub gizlilik politikasi",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 space-y-3">
            <p className="text-sm font-medium text-primary">Literature Hub</p>
            <h1 className="text-3xl font-semibold tracking-tight">Gizlilik Politikasi</h1>
            <p className="text-sm text-muted-foreground">
              Son guncelleme: 29 Mayis 2026
            </p>
          </div>

          <div className="space-y-8 text-sm leading-7 text-slate-700">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Toplanan veriler</h2>
              <p>
                Literature Hub, Google ile giris sirasinda ad, e-posta adresi ve profil
                gorseli gibi temel hesap bilgilerini alabilir. Uygulama ayrica yuklediginiz
                PDF dosyalari ve makale metadata bilgilerini kaydeder.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Verilerin kullanim amaci</h2>
              <p>
                Bu veriler, arastirma grubunun ortak literatur havuzunu yonetmek, makaleleri
                siniflandirmak, projelerle iliskilendirmek ve yetkili kullanicilarin sisteme
                erisimini saglamak icin kullanilir.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Google Drive ve Supabase</h2>
              <p>
                Yuklenen PDF dosyalari Google Drive uzerinde saklanir. Makale basligi,
                yazarlar, yil, etiketler ve proje iliskileri gibi metadata bilgileri Supabase
                altyapisinda tutulur.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Veri paylasimi</h2>
              <p>
                Veriler yalnizca uygulamanin amaclari dogrultusunda ve sisteme erisim izni olan
                ekip uyeleri tarafindan kullanilmak uzere islenir. Ucuncu taraflara ticari
                amacla satilmaz veya devredilmez.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Iletisim</h2>
              <p>
                Gizlilikle ilgili sorulariniz icin uygulama yoneticisiyle veya gelistirici
                iletisim adresi uzerinden iletisime gecebilirsiniz.
              </p>
            </section>
          </div>

          <div className="mt-10 border-t pt-6">
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Uygulamaya don
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
