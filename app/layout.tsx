import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distill — Research, distilled",
  description: "Turn any topic, URL, or document into a structured research report in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}