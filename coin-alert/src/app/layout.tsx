import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "./components/AppHeader";
import "./globals.css";
import { AuthProvider } from "./providers/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Siren",
  description: "Notification app for memecoins",
  twitter: {
    card: 'summary_large_image',
    title: 'Siren Landing Page',
    description: 'Landing page for Siren, a memecoin notification app.',
    images: ['https://www.sirennotify.com/siren-landing-page.jpg'], // Same image
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          
        <AuthProvider>
        <AppHeader/>
        <div className="wrapper">
        {children}
          <footer className="footer">
            © SirenNotify.com, 2025
          </footer>
        </div>

          </AuthProvider>

      </body>  

    </html>
  );
}
