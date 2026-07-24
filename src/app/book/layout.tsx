import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-customer.json",
  appleWebApp: {
    capable: true,
    title: "Book Court",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icons/customer-apple-touch.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F46036",
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
