import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
// Bastliga One (Madhaline Studio), personal-use licence — this is a personal portfolio.
const signature = localFont({ src: "../public/fonts/BastligaOne.otf", weight: "400", variable: "--font-signature", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://porto.nandish.online"),
  title: "Nandisha — Generative AI Engineer",
  description: "Ask my resume anything. Answers are retrieved from my work and cite their sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${signature.variable}`}>
      <body>{children}</body>
    </html>
  );
}
