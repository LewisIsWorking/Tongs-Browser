/**
 * Vite resolves a bare CSS import into a build step that extracts the stylesheet. TypeScript has no
 * knowledge of that, so the side effect import in main.ts needs an ambient declaration.
 */
declare module '*.css';
