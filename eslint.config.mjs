import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

/**
 * The linter.
 *
 * `npm run lint` used to call `next lint`, which is deprecated in Next 15,
 * removed in 16, and — with no config present — dropped into an
 * interactive prompt asking how to set ESLint up. A lint script that
 * cannot run unattended is a lint script that never runs in CI and never
 * runs before a commit, which is the same as not having one.
 *
 * The rule set is Next's own recommended pair plus the TypeScript one.
 * Two rules are turned down, and both for reasons specific to this
 * project rather than to quieten output:
 *
 * `@typescript-eslint/no-unused-vars` keeps its default but ignores names
 * prefixed with an underscore, which is how a deliberately unused
 * destructured field is written here.
 *
 * `react/no-unescaped-entities` is off. The interface is Hebrew, and the
 * rule fires on the geresh and gershayim (׳ ״) that belong inside Hebrew
 * words — "ת״א", "דק׳" — where escaping them would make the source
 * unreadable to anyone maintaining it.
 */

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "content/**",
      "public/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
