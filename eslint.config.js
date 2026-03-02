import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettierFlat from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  eslintConfigPrettierFlat,
  {
    plugins:{
      "simple-import-sort": simpleImportSort,
    },
    rules:{
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    }
  }
]);
