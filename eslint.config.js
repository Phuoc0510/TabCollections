import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node,
        chrome: 'writable',
        ICON_CATEGORIES: 'readonly',
        ICONS: 'readonly',
        COLORS: 'readonly',
        getGroups: 'readonly',
        getTabsByGroup: 'readonly',
        createGroup: 'readonly',
        updateGroup: 'readonly',
        deleteGroup: 'readonly',
        addTabToGroup: 'readonly',
        removeTab: 'readonly',
        getAllData: 'readonly',
        exportData: 'readonly',
        importData: 'readonly',
        updateGroupPositions: 'readonly',
        updateTabPositions: 'readonly',
        moveTabToGroup: 'readonly',
        getPages: 'readonly',
        createPage: 'readonly',
        updatePage: 'readonly',
        deletePage: 'readonly',
        addGroupToPage: 'readonly',
        removeGroupFromPage: 'readonly',
        softDeleteGroup: 'readonly',
        softDeleteTab: 'readonly',
        restoreGroup: 'readonly',
        restoreTab: 'readonly',
        purgeDeleted: 'readonly',
        importScripts: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['storage.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        chrome: 'writable',
      },
    },
  },
  {
    ignores: ['coverage/', 'node_modules/', 'docs/'],
  },
];
