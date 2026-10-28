import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The rows lint paths that do not exist on disk (a real file is linted by its own tsconfig entry). The project service needs
// each one listed to type-check it against tsconfig.json.
const filePaths = [
  "src/features/sample/api.ts",
  "src/features/accounts/screen.tsx",
  "src/features/accounts/x.ts",
  "src/app/x.tsx",
  "src/ui/x.tsx",
  "src/ui/y.tsx",
  "src/ui/z.tsx",
  "src/ui/w.test.tsx",
  "src/privacy/x.ts",
];

// ESLint defaults to the working directory; Vitest runs from web/, which holds eslint.config.js.
const eslint = new ESLint({
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: filePaths,
          // The default allows 8 files; the rows below lint 9.
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 9,
          defaultProject: "tsconfig.json",
        },
      },
    },
  },
});

const importFromAccounts = (specifier: string) =>
  `import { a } from "${specifier}";\nexport { a };\n`;

const rows = [
  {
    name: "O2 deep import of another feature",
    filePath: "src/features/accounts/x.ts",
    code: importFromAccounts("@/features/transactions/api"),
    rule: "no-restricted-imports",
  },
  {
    name: "O2 deep import of the own feature",
    filePath: "src/features/accounts/x.ts",
    code: importFromAccounts("@/features/accounts/api"),
    rule: undefined,
  },
  {
    name: "O2 deep import of a feature from the app",
    filePath: "src/app/x.tsx",
    code: importFromAccounts("@/features/accounts/api"),
    rule: "no-restricted-imports",
  },
  {
    name: "O2 index import of another feature",
    filePath: "src/features/accounts/x.ts",
    code: importFromAccounts("@/features/transactions"),
    rule: undefined,
  },
  {
    name: "O3 client in a screen",
    filePath: "src/features/accounts/screen.tsx",
    code: importFromAccounts("@/api/client"),
    rule: "no-restricted-imports",
  },
  {
    name: "O3 client in api.ts",
    filePath: "src/features/sample/api.ts",
    code: importFromAccounts("@/api/client"),
    rule: undefined,
  },
  {
    name: "O4 app from a feature",
    filePath: "src/features/accounts/x.ts",
    code: importFromAccounts("@/app/router"),
    rule: "no-restricted-imports",
  },
  ...[
    "formatMoney",
    "formatMoneyParts",
    "formatMoneySegments",
    "formatSigned",
    "formatPlain",
  ].map((name) => ({
    name: `O9 ${name} in a screen`,
    filePath: "src/features/accounts/x.ts",
    code: `import { ${name} } from "@/i18n/format";\nexport { ${name} };\n`,
    rule: "@typescript-eslint/no-restricted-imports",
  })),
  {
    name: "O9 formatMoney in a shared component",
    filePath: "src/ui/x.tsx",
    code: 'import { formatMoney } from "@/i18n/format";\nexport { formatMoney };\n',
    rule: "@typescript-eslint/no-restricted-imports",
  },
  {
    name: "O9 formatMoney in the privacy module",
    filePath: "src/privacy/x.ts",
    code: 'import { formatMoney } from "@/i18n/format";\nexport { formatMoney };\n',
    rule: undefined,
  },
  {
    name: "O9 formatMoney in a test",
    filePath: "src/ui/w.test.tsx",
    code: 'import { formatMoney } from "@/i18n/format";\nexport { formatMoney };\n',
    rule: undefined,
  },
  {
    name: "O9 formatDate in a screen",
    filePath: "src/features/accounts/x.ts",
    code: 'import { formatDate } from "@/i18n/format";\nexport { formatDate };\n',
    rule: undefined,
  },
  {
    name: "O6 literal text in JSX",
    filePath: "src/ui/x.tsx",
    code: "export const X = () => <p>Hello</p>;\n",
    rule: "react/jsx-no-literals",
  },
  {
    name: "O1 two components in one file",
    filePath: "src/ui/z.tsx",
    code: "function A() { return null; }\nexport function B() { return <A />; }\n",
    rule: "react/no-multi-comp",
  },
  {
    name: "O1 two components in a test file",
    filePath: "src/ui/w.test.tsx",
    code: "function A() { return null; }\nexport function B() { return <A />; }\n",
    rule: undefined,
  },
  {
    name: "hook called inside a condition",
    filePath: "src/ui/y.tsx",
    code: [
      'import { useState } from "react";',
      "export function Y({ on }: { on: boolean }) {",
      "  if (on) {",
      "    useState(0);",
      "  }",
      "  return null;",
      "}",
      "",
    ].join("\n"),
    rule: "react-hooks/rules-of-hooks",
  },
];

// The first row builds the TypeScript program for the whole project, which outgrows the 5 s default.
const lintTimeoutMs = 30_000;

describe("lint rules", () => {
  it.each(rows)(
    "$name",
    async ({ filePath, code, rule }) => {
      const [result] = await eslint.lintText(code, { filePath });
      const ruleIDs = (result?.messages ?? []).map((m) => m.ruleId);
      if (rule === undefined) {
        expect(ruleIDs).toEqual([]);
      } else {
        expect(ruleIDs[0]).toBe(rule);
      }
    },
    lintTimeoutMs,
  );
});
