import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ZuDe — Kas Zuhri & Devi",
    short_name: "ZuDe",
    description: "Keuangan rumah tangga Zuhri & Devi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    theme_color: "#0F766E",
    background_color: "#F4F6FB",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
