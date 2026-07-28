import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    title: "Heide's Admin",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icons/admin-apple-touch.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2FA8D9",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
