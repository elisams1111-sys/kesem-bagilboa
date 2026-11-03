import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import "./globals.css";

// גופנים עבריים מ-Google Fonts: Heebo לטקסט, Frank Ruhl Libre לכותרות
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["500", "700"], variable: "--font-frank" });

export const metadata: Metadata = {
  title: "קסם בגלבוע – ניהול אירועים",
  description: "תיק אירוע דיגיטלי אחד ללקוחות, למכירות, לניהול האירועים ולמטבח של אולמי וגני האירועים קסם בגלבוע.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
