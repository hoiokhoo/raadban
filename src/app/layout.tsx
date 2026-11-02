import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "رصد‌بان — سامانه هوشمند رصد و راستی‌آزمایی اخبار",
  description:
    "گردآوری خودکار اخبار از تلگرام، ایتا و بله؛ استخراج ادعا، راستی‌آزمایی تاریخ‌محور و گزارش شبانه مبتنی بر حافظه تاریخی.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900 font-[Vazirmatn,'Vazirmatn',system-ui,sans-serif]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
