import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Kullanim Sartlari - Literature Hub",
  description: "Literature Hub kullanim sartlari",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 space-y-3">
            <p className="text-sm font-medium text-primary">Literature Hub</p>
            <h1 className="text-3xl font-semibold tracking-tight">Kullanim Sartlari</h1>
            <p className="text-sm text-muted-foreground">
              Son guncelleme: 29 Mayis 2026
            </p>
          </div>

          <div className="space-y-8 text-sm leading-7 text-slate-700">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Hizmetin amaci</h2>
              <p>
                Literature Hub, arastirma gruplarinin makaleleri ortak bir havuzda toplamasini,
                etiketlemesini ve projelerle iliskilendirmesini saglayan bir uygulamadir.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Kullanici sorumluluklari</h2>
              <p>
                Kullanici, sisteme yukledigi dosyalar ve girdigi bilgiler icin gerekli haklara
                sahip oldugunu kabul eder. Telif hakkini ihlal eden, yetkisiz veya zararli
                icerik yuklenmemelidir.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Erisim ve yetkilendirme</h2>
              <p>
                Uygulamaya erisim Google ile giris uzerinden saglanir. Sistem yoneticisi,
                gerek gordugunde kullanici erisimini sinirlayabilir veya kaldirabilir.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Veri dogrulugu</h2>
              <p>
                Yuklenen makale metadata bilgilerinin dogrulugu kullanicinin sorumlulugundadir.
                Uygulama yoneticileri hatali veya eksik kayitlari duzeltme hakkini sakli tutar.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Degisiklikler</h2>
              <p>
                Bu sartlar gerektiğinde guncellenebilir. Guncel surum bu sayfada yayinlanir ve
                degisiklikler yayinlandigi andan itibaren gecerli olur.
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
