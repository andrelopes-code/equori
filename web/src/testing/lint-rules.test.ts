import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The rows lint paths that do not exist on disk. The project service needs
// each one listed to type-check it against tsconfig.json.
const filePaths = [
  "src/features/accounts/api.ts",
  "src/features/accounts/home-page.tsx",
  "src/features/accounts/x.ts",
  "src/app/x.tsx",
  "src/ui/x.tsx",
  "src/ui/y.tsx",
];

// ESLint defaults to the working directory; Vitest runs from web/, which holds eslint.config.js.
const eslint = new ESLint({
  overrideConfig: {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: filePaths,
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
    filePath: "src/features/accounts/home-page.tsx",
    code: importFromAccounts("@/api/client"),
    rule: "no-restricted-imports",
  },
  {
    name: "O3 client in api.ts",
    filePath: "src/features/accounts/api.ts",
    code: importFromAccounts("@/api/client"),
    rule: undefined,
  },
  {
    name: "O4 app from a feature",
    filePath: "src/features/accounts/x.ts",
    code: importFromAccounts("@/app/router"),
    rule: "no-restricted-imports",
  },
  {
    name: "O6 literal text in JSX",
    filePath: "src/ui/x.tsx",
    code: "export const X = () => <p>Hello</p>;\n",
    rule: "react/jsx-no-literals",
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

describe("lint rules", () => {
  it.each(rows)("$name", async ({ filePath, code, rule }) => {
    const [result] = await eslint.lintText(code, { filePath });
    const ruleIDs = (result?.messages ?? []).map((m) => m.ruleId);
    if (rule === undefined) {
      expect(ruleIDs).toEqual([]);
    } else {
      expect(ruleIDs[0]).toBe(rule);
    }
  });
});
