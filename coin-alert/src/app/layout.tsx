import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers/auth-provider";
import { AppHeader } from "./components/AppHeader";

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
          {children}
          </AuthProvider>
        <footer>
        2025 Siren Copywrite
      </footer>
      </body>  

    </html>
  );
}
