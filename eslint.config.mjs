import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // .kit/ holds the spec + static mockups; ._* are macOS AppleDouble files on non-HFS drives.
    ignores: ["node_modules/**", ".next/**", "out/**", ".kit/**", "**/._*", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
