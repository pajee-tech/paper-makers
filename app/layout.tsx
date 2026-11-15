import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK",
  authors: [{ name: "Pajee Technologies" }],
  description: "Exam paper generator & instant class result maker for Pakistani schools, colleges and academies — Nursery to Graduation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Free Google Fonts: Noto Nastaliq Urdu for RTL Urdu text */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
