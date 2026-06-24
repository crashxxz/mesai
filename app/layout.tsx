import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { PwaRegister } from "@/components/pwa-register";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: brand.name,
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`
  },
  description: `${brand.slogan} ${brand.description}`,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.png?v=6", sizes: "64x64", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png?v=6", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: brand.colors.orange,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <PwaRegister />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
