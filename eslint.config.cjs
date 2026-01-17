const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");

module.exports = [
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            'dist/**',
            'build/**',
            'out/**',
            'backend/**',
            'scripts/**',
            'uploads/**',
            '**/*.config.{js,cjs,mjs}',
            'public/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-console': 'off',
            'prefer-const': 'warn',
            'no-undef': 'off', // TypeScript handles this
        },
    },
    {
        files: ['**/*.{js,jsx}'],
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'prefer-const': 'warn',
        },
    },
];
