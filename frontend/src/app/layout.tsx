import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/lib/theme-context";
import { ModelProvider } from "@/lib/model-context";
import { DatasetProvider } from "@/lib/dataset-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TGDetect — Temporal Graph Neural Network for Threat Detection",
  description:
    "Backend-contract-ready frontend for the TGDetect backend: TGEvent investigation, temporal heterogeneous graph, attack-chain reconstruction, parquet artifacts, and TGNN (GraphSAGE + GRU) model views.",
  keywords: [
    "TGDetect",
    "Temporal Graph",
    "Graph Neural Network",
    "GraphSAGE",
    "GRU",
    "TGNN",
    "Threat Detection",
    "Attack Chain",
    "MITRE ATT&CK",
  ],
  authors: [{ name: "TGDetect" }],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider><ModelProvider><DatasetProvider>{children}</DatasetProvider></ModelProvider></ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
