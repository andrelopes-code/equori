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

// O9: an amount reaches the screen through useMoneyFormat, which masks it while privacy is on.
const unmaskedMoney = [
  "formatMoney",
  "formatMoneyParts",
  "formatMoneySegments",
  "formatSigned",
  "formatPlain",
].map((importName) => ({
  name: "@/i18n/format",
  importNames: [importName],
  message: `Write amounts through useMoneyFormat() so privacy mode can mask them (O9). ${importName} is for @/i18n and @/privacy.`,
}));

// O13: a router link drawn on its own takes the browser's colour and size. It is only the
// element a Slotted part renders through its render prop, which spreads the part's props.
const bareRouterLink = {
  selector:
    'JSXOpeningElement[name.name="Link"]:has(JSXAttribute[name.name="to"]):not(:has(JSXSpreadAttribute))',
  message:
    "Draw a link with AppLink (@/ui/navigation/app-link) or the Slotted Link with useAppLink (O13).",
};

// Below 1024 px the shell's top app bar carries a page's way back; PageBack draws it only above.
const pageHeaderBack = {
  selector: 'JSXOpeningElement[name.name="PageHeaderBack"]',
  message: "Draw a page's way back with PageBack (@/ui/navigation/page-back).",
};

// O15: InlineMessage is the root of FieldError and FieldDescription. A message about a command, a
// form or a region is a FormNotice (@/ui/form-layout/form-notice); one about a control is a FieldError.
const bareInlineMessage = {
  selector: 'JSXOpeningElement[name.name="InlineMessage"]',
  message:
    "Draw a field's error with FieldError and any other message with FormNotice (@/ui/form-layout/form-notice) (O15).",
};

// O17: a Heading directly inside a Stack puts the title, its description and the content at one
// equal gap. A titled block is a Section (@slotted/react/section), which sets the spacing.
const stackedHeading = {
  selector:
    'JSXElement[openingElement.name.name="Stack"] > JSXElement[openingElement.name.name="Heading"]',
  message:
    "Draw a titled block with Section, SectionHeader and SectionBody (@slotted/react/section), not a Heading inside a Stack (O17).",
};

// O19: the blocks of a page stand at the page's own gaps (spec 2026-11-17-page-spacing, PS3). A
// Stack under PageBody picks a step of its own, and the pages drift apart.
const pageBodyStack = {
  selector:
    'JSXElement[openingElement.name.name="PageBody"] > JSXElement[openingElement.name.name="Stack"]',
  message:
    "Stack the blocks of a page in PageStack (@/ui/page-layout/page-stack), not in a Stack with a gap of its own (O19).",
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
    // A separate rule key, so it merges with the blocks above instead of replacing their options.
    files: ["src/**"],
    ignores: [
      "src/i18n/**",
      "src/privacy/**",
      "src/testing/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { paths: unmaskedMoney },
      ],
    },
  },
  {
    files: ["src/app/providers.tsx", "src/api/**", "src/testing/**"],
    rules: {
      "no-restricted-imports": restrict({
        patterns: [relativeImport, featureInternals],
      }),
    },
  },
  {
    // Node runs the theme compiler and this test without the @/ alias, so the theme files import
    // each other by relative path.
    files: [
      "src/theme/equori.theme.test.ts",
      "src/theme/equori.theme.ts",
      "src/theme/equori-glass.theme.ts",
      "src/theme/equori-glass.theme.test.ts",
      "src/theme/glass/**",
      "src/theme/overlay-items.ts",
      "src/theme/surface-gen.ts",
      "src/theme/surface-recipe.theme.test.ts",
      "src/theme/surface-sheet.ts",
    ],
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
      "no-restricted-syntax": [
        "error",
        bareRouterLink,
        pageHeaderBack,
        bareInlineMessage,
        stackedHeading,
        pageBodyStack,
      ],
    },
  },
  {
    // A title block (a page title with its subtitle, a welcome, a featured card) heads one
    // surface; it is not a titled region of a page, so O17 does not apply.
    files: [
      "src/features/assistant/panel/chat-welcome.tsx",
      "src/features/help/featured/help-featured.tsx",
      "src/features/session/login/login-password-form.tsx",
      "src/features/session/login/login-second-factor.tsx",
      "src/features/session/pages/invite-page.tsx",
      "src/features/session/pages/setup-page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        bareRouterLink,
        pageHeaderBack,
        bareInlineMessage,
      ],
    },
  },
  {
    // O19, PS5: the column of these pages is a form, its placeholder or a stepper, spaced by the
    // form's own steps, not a list of blocks.
    files: [
      "src/features/accounts/account-form/account-form-placeholder.tsx",
      "src/features/accounts/pages/import-page.tsx",
      "src/features/start/start-page.tsx",
      "src/features/start/start-screen.tsx",
      "src/features/transactions/correction/correction-form.tsx",
      "src/features/transactions/correction/correction-page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        bareRouterLink,
        pageHeaderBack,
        bareInlineMessage,
        stackedHeading,
      ],
    },
  },
  {
    files: ["src/ui/navigation/page-back.tsx"],
    rules: {
      "no-restricted-syntax": ["error", bareRouterLink, bareInlineMessage],
    },
  },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
  {
    // A classic script served as written, before the application loads (index.html).
    files: ["public/boot.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        document: "readonly",
        localStorage: "readonly",
        matchMedia: "readonly",
      },
    },
  },
  {
    // The service worker, a classic script in its own global scope (ADR 022, P1).
    files: ["public/sw.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },
  },
);
