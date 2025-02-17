import globals from "globals";


/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { languageOptions: { globals: globals.browser } }, {
    "rules": {
      "no-undef": "off"
    }
  }
];