import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  SiteFooter,
  SiteHeader,
  SocialBlock,
  SocialRail,
  ThemeRail,
} from "@/components/chrome";

const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Noah Homick — Sports Photography",
    template: "%s — Noah Homick",
  },
  description:
    "Game-day sports photography in Midland, Ontario. Browse your game gallery and take home the shot.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable}`}>
        <Providers>
          <div className="shell">
            <SiteHeader />
            <ThemeRail />
            <SocialRail />
            <main>{children}</main>
            <SocialBlock />
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
