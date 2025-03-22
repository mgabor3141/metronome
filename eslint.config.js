import eslintPluginAstro from "eslint-plugin-astro"
import js from "@eslint/js"
import svelte from "eslint-plugin-svelte"
import globals from "globals"
import ts from "typescript-eslint"
import svelteConfig from "./svelte.config.js"

export default [
	js.configs.recommended,
	...ts.configs.strict,
	...ts.configs.stylistic,
	...svelte.configs.recommended,
	...svelte.configs.prettier,
	...eslintPluginAstro.configs.recommended,
	...eslintPluginAstro.configs["jsx-a11y-recommended"],
	{
		linterOptions: {
			reportUnusedInlineConfigs: "error",
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				...globals.browser,

				// Bun globals
				...{
					Timer: "readonly",
				},
			},
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		// See more details at: https://typescript-eslint.io/packages/parser/
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: [".svelte", ".svelte.ts"],
				parser: ts.parser,
				svelteFeatures: {
					experimentalGenerics: true,
				},
				svelteConfig,
			},
		},
	},
	{
		files: ["*.astro"],
		parser: "astro-eslint-parser",
	},
	{
		ignores: ["dist/*", ".astro/*"],
	},
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/consistent-type-definitions": ["error", "type"],
		},
	},
]
