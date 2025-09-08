// Import Next.js types and Google Fonts
import type { Metadata } from "next";
import { Inter, Roboto_Mono, Playfair_Display } from "next/font/google";
// Import global CSS styles
import "./globals.css";

// FONT CONFIGURATIONS: Define Google Fonts with CSS variables
// Inter - Modern sans-serif font for body text
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Roboto Mono - Monospace font for code/technical content
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

// Playfair Display - Elegant serif font for headings
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

// METADATA: SEO and browser information
export const metadata: Metadata = {
  title: "IU Research Study - Human Connection",                        // Browser tab title
  description: "Indiana University research study exploring how people connect and build relationships through conversation", // Meta description for SEO
  icons: {
    icon: "/Indiana_Hoosiers_logo.svg",        // Favicon in browser tab
    shortcut: "/Indiana_Hoosiers_logo.svg",   // Shortcut icon
    apple: "/Indiana_Hoosiers_logo.svg",      // Apple touch icon for mobile
  },
};

// ROOT LAYOUT: Wraps all pages in the application
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // All page content will be passed as children
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
