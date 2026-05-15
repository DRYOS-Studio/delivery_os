import type { Metadata } from "next";
import { Funnel_Display, Onest, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-funnel-display",
  display: "swap",
});

const onest = Onest({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onest",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DRYOS Delivery",
  description: "Sistema operacional interno da DRYOS.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${funnelDisplay.variable} ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-body bg-bg text-ink-soft antialiased">
        {children}
      </body>
    </html>
  );
}
