# Obsidian Font Picker

Font Picker is a small Obsidian desktop plugin for quickly changing the editor font from a command palette modal.

It adds a `Change font` command that opens a searchable list of installed macOS fonts. Choosing a font applies it immediately to the Markdown editor and saves the choice so it is restored the next time Obsidian starts.

## Features

- Search and select from installed macOS font families.
- Preview fonts directly in the picker: each font name is rendered in its own font.
- Temporarily preview fonts with the arrow keys before confirming a choice.
- Reset back to Obsidian's default editor font.
- No build step required. The plugin is distributed as plain `main.js`, `manifest.json`, and `styles.css`.

## Platform Support

This version is intended for Obsidian Desktop on macOS.

Font discovery uses the browser local-font API when available, then falls back to macOS `system_profiler`, and finally to scanning common macOS font directories.

## Installation

### Manual Installation

1. Download or clone this repository.
2. Copy the `font-picker` folder into your vault's plugins folder:

   ```text
   YourVault/.obsidian/plugins/font-picker
   ```

3. Restart Obsidian, or reload plugins.
4. Open `Settings -> Community plugins`.
5. Enable `Font Picker`.

The final folder should contain:

```text
font-picker/
  manifest.json
  main.js
  styles.css
```

## Usage

1. Open the command palette.
2. Run `Change font`.
3. Search or scroll to a font.
4. Press `Enter` or click a font to apply it.

Select `Default editor font` to remove the override and return to Obsidian's normal editor font.

## How It Works

The plugin applies the selected font by injecting a small style block that overrides Obsidian's editor font variables and CodeMirror editor font styles. It stores only the selected font family name in the plugin's local data file.

## Privacy

Font Picker does not send data anywhere. Font discovery and settings storage happen locally inside Obsidian.

## Limitations

- This is currently macOS-only.
- It changes the editor font, not every interface font in Obsidian.
- Some fonts may not visibly differ in the picker if macOS or Chromium cannot render that family in the current context.

## Credits

The plugin structure and fuzzy picker interaction were inspired by the `theme-picker` Obsidian plugin.

