import { readdirSync } from "node:fs";
import { join } from "node:path";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const relativeImport = {
  regex: "^\\.{1,2}/",
  message: "Import modules of src/ through the @/ alias.",
};
const featureInternals = {
  regex: "^@/features/[^/]+/.+",
  message: "Import a feature through its index.ts.",
};
const appFromFeature = {
  regex: "^@/app/",
  message: "A feature never imports from @/app.",
};
const apiClient = {
  name: "@/api/client",
  message:
    "Only features/*/api.ts, features/session and app/providers.tsx use the API client.",
};

// Flat-config rule options replace instead of merging: every block below
// restates the full option list for its files.
const restrict = ({ patterns, paths = [] }) => ["error", { patterns, paths }];

// One block per feature directory: a feature may import its own deep paths
// (O2), so its O2 regex excludes itself.
const featuresDir = join(import.meta.dirname, "src", "features");
const featureNames = (() => {
  try {
    return readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
})();

const featureBlocks = featureNames.flatMap((name) => {
  const otherFeatureInternals = {
    ...featureInternals,
    regex: `^@/features/(?!${name}/)[^/]+/.+`,
  };
  const patterns = [relativeImport, otherFeatureInternals, appFromFeature];
  return [
    {
      files: [`src/features/${name}/**`],
      rules: {
        "no-restricted-imports": restrict({
          patterns,
          paths: name === "session" ? [] : [apiClient],
        }),
      },
    },
    {
      files: [`src/features/${name}/api.ts`],
      rules: { "no-restricted-imports": restrict({ patterns }) },
    },
  ];
});

export default defineConfig(
  { ignores: ["dist", "**/*.gen.ts"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "no-restricted-imports": restrict({ patterns: [relativeImport] }),
    },
  },
  {
    files: ["src/**"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [relativeImport, featureInternals],
        paths: [apiClient],
      }),
    },
  },
  {
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [relativeImport, featureInternals, appFromFeature],
        paths: [apiClient],
      }),
    },
  },
  {
    files: ["src/features/*/api.ts", "src/features/session/**"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [relativeImport, featureInternals, appFromFeature],
      }),
    },
  },
  ...featureBlocks,
  {
    files: ["src/app/providers.tsx", "src/api/**", "src/testing/**"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [relativeImport, featureInternals],
      }),
    },
  },
  {
    // Node runs this test without the @/ alias, so it imports ./equori.theme.ts.
    files: ["src/theme/equori.theme.test.ts"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [featureInternals],
        paths: [apiClient],
      }),
    },
  },
  {
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    plugins: { react },
    settings: { react: { version: "19.3" } },
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true },
      ],
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
    },
  },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
