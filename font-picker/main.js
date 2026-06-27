'use strict';

const obsidian = require('obsidian');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_SETTINGS = {
	fontFamily: ''
};

const DEFAULT_FONT_ITEM = {
	family: '',
	label: 'Default editor font'
};

function uniqSorted(values) {
	return Array.from(new Set(values.filter((value) => value && !value.startsWith('.')))).sort((a, b) => a.localeCompare(b));
}

function cssFontFamily(fontFamily) {
	return `"${fontFamily.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function execFileJson(command, args) {
	return new Promise((resolve, reject) => {
		execFile(command, args, { maxBuffer: 1024 * 1024 * 20 }, (error, stdout) => {
			if (error) {
				reject(error);
				return;
			}

			try {
				resolve(JSON.parse(stdout));
			}
			catch (parseError) {
				reject(parseError);
			}
		});
	});
}

function getFontNameFromFile(fileName) {
	const extension = path.extname(fileName).toLowerCase();
	if (!['.ttf', '.ttc', '.otf', '.dfont'].includes(extension)) {
		return null;
	}

	return path
		.basename(fileName, extension)
		.replace(/[-_](Regular|Bold|Italic|Medium|Light|Semibold|SemiBold|Book|Black|Thin|Heavy|Condensed|Extended).*$/i, '')
		.replace(/[-_]/g, ' ')
		.trim();
}

class FontProvider {
	constructor() {
		this.cachedFonts = null;
	}

	async getFonts() {
		if (this.cachedFonts) {
			return this.cachedFonts;
		}

		let fonts = await this.getFontsFromLocalFontAccess();
		if (fonts.length === 0) {
			fonts = await this.getFontsFromSystemProfiler();
		}
		if (fonts.length === 0) {
			fonts = this.getFontsFromDirectories();
		}

		this.cachedFonts = uniqSorted(fonts).map((family) => ({
			family,
			label: family
		}));

		return this.cachedFonts;
	}

	async getFontsFromLocalFontAccess() {
		if (typeof window.queryLocalFonts !== 'function') {
			return [];
		}

		try {
			const localFonts = await window.queryLocalFonts();
			return localFonts.map((font) => font.family);
		}
		catch (error) {
			console.debug('Font Picker: local font access failed', error);
			return [];
		}
	}

	async getFontsFromSystemProfiler() {
		if (process.platform !== 'darwin') {
			return [];
		}

		try {
			const fontData = await execFileJson('/usr/sbin/system_profiler', ['SPFontsDataType', '-json']);
			const fonts = fontData.SPFontsDataType || [];
			return fonts.flatMap((font) => {
				if (font.typefaces && font.typefaces.length > 0) {
					return font.typefaces.map((typeface) => typeface.family || typeface.fullname || typeface._name);
				}

				return font.family || font._name;
			});
		}
		catch (error) {
			console.debug('Font Picker: system_profiler font lookup failed', error);
			return [];
		}
	}

	getFontsFromDirectories() {
		if (process.platform !== 'darwin') {
			return [];
		}

		const fontDirectories = [
			'/System/Library/Fonts',
			'/Library/Fonts',
			path.join(os.homedir(), 'Library/Fonts')
		];

		const fonts = [];

		for (const fontDirectory of fontDirectories) {
			try {
				for (const fileName of fs.readdirSync(fontDirectory)) {
					const fontName = getFontNameFromFile(fileName);
					if (fontName) {
						fonts.push(fontName);
					}
				}
			}
			catch (error) {
				console.debug(`Font Picker: could not read ${fontDirectory}`, error);
			}
		}

		return fonts;
	}
}

class FontPickerModal extends obsidian.FuzzySuggestModal {
	constructor(app, plugin, fonts) {
		super(app);
		this.plugin = plugin;
		this.fonts = [DEFAULT_FONT_ITEM, ...fonts];
		this.previewing = false;
		this.initialFont = plugin.settings.fontFamily;
		this.limit = Math.max(this.fonts.length, 1000);

		this.bgEl.setAttribute('style', 'background-color: transparent');
		this.modalEl.classList.add('font-picker-modal');
		this.setPlaceholder('Choose an editor font');
		this.enablePreviewOnArrowKeys();
	}

	onOpen() {
		super.onOpen();
		this.selectCurrentFont();
	}

	onClose() {
		super.onClose();
		if (this.previewing) {
			this.plugin.applyFont(this.initialFont);
		}
	}

	getItems() {
		return this.fonts;
	}

	getItemText(item) {
		return item.label;
	}

	onChooseItem(item) {
		this.previewing = false;
		this.plugin.setFont(item.family);
	}

	renderSuggestion(result, el) {
		super.renderSuggestion(result, el);
		el.classList.add('font-picker-suggestion');
		const item = result && result.item ? result.item : result;

		if (item.family) {
			const fontStack = `${cssFontFamily(item.family)}, var(--font-interface)`;
			el.style.setProperty('font-family', fontStack, 'important');

			for (const child of el.querySelectorAll('*')) {
				child.style.setProperty('font-family', fontStack, 'important');
			}
		}
	}

	selectCurrentFont() {
		const selectedIndex = this.fonts.findIndex((font) => font.family === this.plugin.settings.fontFamily);
		if (selectedIndex < 0 || !this.chooser) {
			return;
		}

		if (typeof this.chooser.setSelectedItem === 'function') {
			this.chooser.setSelectedItem(selectedIndex);
		}

		const suggestion = this.chooser.suggestions && this.chooser.suggestions[selectedIndex];
		if (suggestion && typeof suggestion.scrollIntoViewIfNeeded === 'function') {
			suggestion.scrollIntoViewIfNeeded();
		}
		else if (suggestion) {
			suggestion.scrollIntoView({ block: 'nearest' });
		}
	}

	enablePreviewOnArrowKeys() {
		const arrowKeys = this.scope && this.scope.keys
			? this.scope.keys.filter((key) => key.key === 'ArrowUp' || key.key === 'ArrowDown')
			: [];

		for (const arrowKey of arrowKeys) {
			const originalFunc = arrowKey.func;
			arrowKey.func = (event) => {
				originalFunc(event, null);
				this.previewSelectedFont();
			};
		}
	}

	previewSelectedFont() {
		const selectedItem = this.chooser && this.chooser.values
			? this.chooser.values[this.chooser.selectedItem]
			: null;

		if (!selectedItem || !selectedItem.item) {
			return;
		}

		this.plugin.applyFont(selectedItem.item.family);
		this.previewing = true;
	}
}

class FontPicker extends obsidian.Plugin {
	async onload() {
		this.fontProvider = new FontProvider();
		await this.loadSettings();
		this.addStyleElement();
		this.applyFont(this.settings.fontFamily);

		this.addCommand({
			id: 'change-font',
			name: 'Change font',
			callback: async () => {
				const loadingNotice = new obsidian.Notice('Loading fonts...', 0);
				try {
					const fonts = await this.fontProvider.getFonts();
					loadingNotice.hide();
					new FontPickerModal(this.app, this, fonts).open();
				}
				catch (error) {
					loadingNotice.hide();
					console.error('Font Picker: unable to load fonts', error);
					new obsidian.Notice('Font Picker could not load your system fonts.');
				}
			}
		});
	}

	onunload() {
		if (this.styleEl) {
			this.styleEl.remove();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addStyleElement() {
		this.styleEl = document.createElement('style');
		this.styleEl.id = 'font-picker-editor-font';
		document.head.appendChild(this.styleEl);
	}

	applyFont(fontFamily) {
		if (!this.styleEl) {
			return;
		}

		if (!fontFamily) {
			this.styleEl.textContent = '';
			return;
		}

		const font = cssFontFamily(fontFamily);
		this.styleEl.textContent = `
.markdown-source-view.mod-cm6 {
	--font-editor-override: ${font};
	--font-editor: ${font};
	--font-text: ${font};
}

.markdown-source-view.mod-cm6 .cm-editor,
.markdown-source-view.mod-cm6 .cm-content,
.markdown-source-view.mod-cm6 .cm-line {
	font-family: ${font}, var(--font-editor-theme), var(--font-text-theme), sans-serif;
}
`;
	}

	async setFont(fontFamily) {
		this.settings.fontFamily = fontFamily;
		this.applyFont(fontFamily);
		await this.saveSettings();

		const message = fontFamily ? `Editor font changed to ${fontFamily}.` : 'Editor font reset.';
		new obsidian.Notice(message);
	}
}

module.exports = FontPicker;
