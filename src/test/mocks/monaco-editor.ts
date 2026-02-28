/**
 * Minimal stub for the bare `monaco-editor` npm package.
 * Used by vitest via the vite alias `monaco-editor → this file`
 * so that modules importing `monaco-editor` (e.g. editorRegistry.ts)
 * resolve cleanly in the jsdom test environment.
 *
 * Only the types/shapes actually exercised in tests need to be present here.
 */
export const editor = {}
export const languages = {}
export const KeyMod = {}
export const KeyCode = {}
