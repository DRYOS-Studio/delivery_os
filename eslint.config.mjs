import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

/**
 * O core-web-vitals do Next 16 puxa regras do React Compiler que quebram
 * no código existente (forms, ícones dinâmicos, etc.). Mantemos o preset e
 * afrouxamos só o que já vinha assim no repo antes de termos script `lint`.
 */
/** @type {import("eslint").Linter.Config[]} */
export default defineConfig([
  ...nextVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "supabase/**",
      "docs/**/*.html",
    ],
  },
  {
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react/no-unescaped-entities": "warn",
    },
  },
]);
