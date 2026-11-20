import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [...compat.extends("next/core-web-vitals", "next/typescript"), { ignores: [".next/**", "public/sw.js"] },
  // Gambar yang dipakai hanya ikon/logo statis kecil dari /public — next/image tidak diperlukan.
  { rules: { "@next/next/no-img-element": "off" } }];
