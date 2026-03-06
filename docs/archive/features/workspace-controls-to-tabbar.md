# Workspace Controls to Tab Bar

## Summary
Moved workspace save, notes, and name display from the header to the tab bar. Reduces header clutter and colocates workspace actions with the tabs they belong to.

## Changes
- **Header**: Removed workspace name, save button, and notes button
- **Tab bar**: Active tab shows save and notes icons. All tabs show a notes dot indicator when notes exist.
- **Notes panel**: Slides up from the tab bar (previously pushed down from header)
- **Save UX**: One-click save (no modal). Uses current tab name. Upserts if workspace with same name exists.
- **Ctrl+S**: Global keyboard shortcut to save the current workspace
- **Accessibility**: Tab elements changed from nested buttons to proper div+button structure

## How to Use
- Click the save icon on the active tab or press Ctrl+S to save
- Double-click a tab name to rename before saving
- Click the notes icon to toggle the notes panel
- Notes auto-save on blur or Escape
