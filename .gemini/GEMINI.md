# Proje Bağlamı: Next.js/TypeScript Kurumsal Uygulama

Bu depo, Next.js (App Router), TypeScript (Kesin mod etkin), Tailwind CSS kullanılarak oluşturulmuş kurumsal düzeyde bir web uygulamasıdır. Gemini, tüm görevlerde bu yönergeleri uygulamalıdır.

## 1. Teknoloji ve Mimari Kısıtlamaları

1.  **Dil Kısıtlaması:** Kesinlikle TypeScript kullanın. Tüm yeni bileşenlerde ve veri işleme mantığında tür güvenliğini sağlayın.
2.  **Next.js Kullanımı:**
    - Mümkün olduğunca **Sunucu Bileşenlerini (Server Components)** kullanın, özellikle veri getirme (data fetching) işlemleri için.
    - Kullanıcı etkileşimi gerektiren yerlerde **İstemci Bileşenlerini (Client Components)** kullanın (`'use client'`).
3.  **Dizin Yapısı:**
    - `/app`: Next.js rotaları.
    - `/components`: Yeniden kullanılabilir UI bileşenleri (Shadcn ve özel bileşenler).
    - `/lib`: Sunucu tarafı ve yardımcı işlevler.
    - `/types`: Uygulama genelinde kullanılan tüm özel TypeScript türleri (types) ve arayüzler (interfaces).

## 2. Stil ve Bileşen Kuralları (Tailwind / Shadcn)

1.  **Tasarım Sistemi:** Tüm UI öğeleri, Tailwindcss ile türetilmelidir. Kendi özel bileşenlerinizi oluştururken mevcut Tailwindcss sınıflarına uyun.
2.  **Stil Kılavuzu:** Tailwind CSS sınıfları, okunabilirliği artırmak için her zaman tutarlı bir sırayla (örneğin: Layout, Flex, Spacing, Sizing, Typography, Backgrounds, Effects) düzenlenmelidir.
3.  **Erişilebilirlik (A11y):** Oluşturulan tüm bileşenler, WAI-ARIA standartlarına uygun olmalı ve klavye navigasyonunu desteklemelidir.

## 3. Kod İnceleme ve Yeniden Düzenleme Talimatları

1.  Yeni kod eklerken veya mevcut kodu yeniden düzenlerken, önce kodu neden değiştirdiğinizi ve nihai amacınızı açıklayan bir **plan** oluşturun [4].
2.  Tüm işlevler için JSDoc tarzı açıklamalar ekleyin.
