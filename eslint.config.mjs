import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// The previous config registered only the @next/next plugin's RULES without
// the parser that goes with them, so every file containing JSX failed with
// "Parsing error: Unexpected token <" — which meant `npm run lint` had never
// actually linted this project. eslint-config-next ships the flat config with
// the right parser, plugins and React/hooks rules already wired together.
const eslintConfig = [
  ...next,
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "node_modules/**", "data/**"],
  },
];

export default eslintConfig;
