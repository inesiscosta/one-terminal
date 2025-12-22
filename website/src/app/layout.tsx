import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "next-themes";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "one-terminal | Terminal Component for React",
  description: "Add an interactive terminal easter egg to your portfolio or website. Fully customizable themes, commands, and behaviours.",
  keywords: ["react", "terminal", "component", "interactive", "customizable", "npm"],
  authors: [{ name: "Inês Costa" }],
  openGraph: {
    title: "one-terminal | Terminal Component for React",
    description: "Add an interactive terminal easter egg to your portfolio or website. Fully customizable themes, commands, and behaviours.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
