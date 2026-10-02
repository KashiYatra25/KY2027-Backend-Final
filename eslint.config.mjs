import { config } from '@repo/eslint-config/base';

/** @type {import("eslint").Linter.Config} */
export default [
  { ignores: ['data/seeder.ts', 'data/mongo.seeder.ts'] },
  ...config,
  {
    rules: {
      'import/no-unresolved': 'off',
      'no-console': 'off',
      'arrow-body-style': 'off',
      'lines-between-class-members': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'consistent-return': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-param-reassign': 'off',
      'no-underscore-dangle': 'off',
      'max-classes-per-file': 'off',
      'no-useless-catch': 'off',
      'camelcase': 'off',
      'no-unused-vars': 'off',
    },
  }
];
