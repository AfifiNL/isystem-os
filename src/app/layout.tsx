import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist_Mono, Instrument_Sans, Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { AuthListener } from "@/features/auth/ui/auth-listener";
import { ThreeWarningsSilencer } from "@/shared/ui/three-warnings-silencer";
import { LOCALE_COOKIE_KEY } from "@/shared/lib/i18n/cookies";
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER_KEY,
  PATHNAME_HEADER_KEY,
  getLocaleDirection,
  isNonLocalizedPath,
  isSupportedLocale,
} from "@/shared/lib/i18n/routing";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { settings, config, locale } = await getActiveTemplate();
  const siteName = settings.siteName || config.name;
  const customFavicon = settings.siteChrome?.brand.faviconUrl?.trim();
  const localizedDescription = pickSiteDescription(settings, locale) || config.description;

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description: localizedDescription,
    applicationName: siteName,
    // Default icons are served from src/app/{favicon.ico,icon.png,apple-icon.png}
    // via Next.js file-based conventions. Only override when a workspace has
    // uploaded a custom favicon in the dashboard.
    ...(customFavicon
      ? {
          icons: {
            icon: [{ url: customFavicon }],
            shortcut: [{ url: customFavicon }],
            apple: [{ url: customFavicon }],
          },
        }
      : {}),
  };
}

export const viewport = {
  themeColor: "#002f58",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const pathname = headerStore.get(PATHNAME_HEADER_KEY) ?? "/";

  // Force English LTR for non-localized surfaces (admin dashboard, login,
  // setup) regardless of the visitor's locale cookie. The dashboard UI is
  // English-only by product decision; bleeding RTL into it would break the
  // admin shell.
  const isAdminSurface = isNonLocalizedPath(pathname);
  const resolvedLocale = isAdminSurface
    ? DEFAULT_LOCALE
    : isSupportedLocale(headerLocale)
      ? headerLocale
      : isSupportedLocale(cookieLocale)
        ? cookieLocale
        : DEFAULT_LOCALE;
  const direction = getLocaleDirection(resolvedLocale);

  return (
    <html lang={resolvedLocale} dir={direction} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${instrumentSans.variable} ${geistMono.variable} ${notoSansArabic.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThreeWarningsSilencer />
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
