import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            'prefer-const': 'warn',
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-empty-object-type': 'warn',
        },
    },
    {
        ignores: [
            'dist/**/*.ts',
            'dist/**',
            '**/*.mjs',
            'eslint.config.mjs',
            '**/*.js',
            'vitest.config.ts',
            'deploy/cdk.out/**',
            'drafts/**',
            'build/**',
            '**/*.spec.ts',
        ],
    },
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                project: './tsconfig.json',
            },
        },
    },
)
