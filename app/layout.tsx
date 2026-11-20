import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { PwaClient } from "@/components/pwa-client";
import { ToastProvider } from "@/components/ui/toast";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ZuDe — Kas Zuhri & Devi", template: "%s · ZuDe" },
  description: "Keuangan rumah tangga Zuhri & Devi",
  applicationName: "ZuDe",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ZuDe", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1120" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("zude_theme")?.value;
  const dataTheme = theme === "light" || theme === "dark" ? theme : "system";
  return (
    <html lang="id" data-theme={dataTheme} className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans">
        <ToastProvider>
          <div className="app-shell">
            <div className="bg-blobs" aria-hidden />
            {children}
          </div>
          <PwaClient />
        </ToastProvider>
      </body>
    </html>
  );
}
