import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import { defineConfig, globalIgnores } from "eslint/config";
import stylistic from "@stylistic/eslint-plugin";
import leaflet from "eslint-plugin-rc-leaflet";


export default defineConfig([
	globalIgnores(["static/*eaflet*.js"], "Ignore leaflet"),
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: {
			js,
			'@stylistic': stylistic,
			"rc-leaflet": leaflet
		},
		extends: ["js/recommended"],
		rules: {
			"@stylistic/brace-style": ["error", "1tbs", { "allowSingleLine": false }],
			"use-isnan": "error",
			"@stylistic/comma-dangle": ["error", "never"],
			"@stylistic/comma-spacing": "error",
			"@stylistic/comma-style": "error",
			"curly": ["error", "multi-line", "consistent"],
			"@stylistic/dot-location": ["error", "property"],
			"@stylistic/indent": ["error", "tab", { "SwitchCase": 1 }],
			"max-nested-callbacks": ["error", { "max": 4 }],
			"@stylistic/max-statements-per-line": ["error", { "max": 4 }],
			"no-console": "off",
			"no-empty-function": "error",
			"@stylistic/no-floating-decimal": "error",
			"@stylistic/no-multi-spaces": "error",
			"@stylistic/no-multiple-empty-lines": ["error", { "max": 3, "maxEOF": 1, "maxBOF": 0 }],
			"@stylistic/no-trailing-spaces": ["error"],
			"no-unused-vars": "off",
			"no-var": "error",
			"@stylistic/object-curly-spacing": ["error", "always"],
			"prefer-const": "error",
			"@stylistic/space-in-parens": "error",
			"@stylistic/space-infix-ops": "error",
			"@stylistic/space-unary-ops": "error",
			"@stylistic/spaced-comment": "error",
			"no-lonely-if": "error",
			"no-plusplus": ["error", { "allowForLoopAfterthoughts": true }],
			"@stylistic/space-before-blocks": ["error", { "functions": "never", "keywords": "never", "classes": "always" }],
			"@stylistic/space-before-function-paren": ["error", { "anonymous": "never", "named": "never", "asyncArrow": "always" }],
			"@stylistic/keyword-spacing": ["error", {
				"before": true,
				"after": true,
				"overrides": {
					"if": { "after": false },
					"for": { "after": false },
					"while": { "after": false },
					"switch": { "after": false }
				}
			}],
			"@stylistic/arrow-spacing": ["error", { "before": true, "after": true }],
			"constructor-super": "error",
			"for-direction": "error",
			"no-cond-assign": "error",
			"no-constructor-return": "error",
			"no-duplicate-imports": "error",
			"no-fallthrough": "error",
			"@stylistic/semi": ["error", "always"],
			"@stylistic/semi-style": ["error", "last"]
		}
	},
	{ files: ["**/*.mjs"], languageOptions: { globals: { ...globals.browser } } },
	{ files: ["**/*.{js,cjs}"], languageOptions: { globals: { ...globals.node }, sourceType: "commonjs" } },
	{ files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] }
]);