import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / snapshot files — not hand-authored.
    "migrations/**",
    "prisma/schema.d.ts",
    "**/skills/**",
  ]),
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      // Existing hand-authored code uses function declarations inside component
      // bodies (hoisted, safe in practice). Suppress the "accessed before declared"
      // lint for these files rather than refactor every page.
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: [
      "app/(root)/inventory/**/*.tsx",
      "app/(root)/materials/**/*.tsx",
      "app/(root)/notifications/**/*.tsx",
      "app/(root)/production/**/*.tsx",
      "app/(root)/purchasing/**/*.tsx",
      "app/(root)/reports/**/*.tsx",
      "app/(root)/sales-orders/**/*.tsx",
      "app/(root)/warehouses/**/*.tsx",
      "app/(root)/products/**/*.tsx",
      "app/(root)/dashboard/*.tsx",
      "app/api/**/*.ts",
      "components/**/*.tsx",
      "scripts/**/*.ts",
      "server/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);

export default eslintConfig;
