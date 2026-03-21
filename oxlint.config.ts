import {all} from '@evanpurkhiser/oxc-config/oxlint';
import {defineConfig} from 'oxlint';

export default defineConfig({
  extends: all,
  rules: {
    'simple-import-sort/exports': 'off',
    'simple-import-sort/imports': 'off',
  },
});
