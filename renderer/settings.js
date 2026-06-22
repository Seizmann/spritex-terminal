(() => {
  const { ipcRenderer } = require('electron');

  class SettingsManager {
    constructor() {
      this.config = null;
      this.onConfigChangeCallbacks = [];
      this.initElements();
      this.bindEvents();
      this.loadConfig();
    }

    initElements() {
      this.drawer = document.getElementById('settings-drawer');
      this.form = document.getElementById('settings-form');
      this.btnSave = document.getElementById('btn-save-settings');
      this.btnCancel = document.getElementById('btn-cancel-settings');
      this.btnOpen = document.getElementById('settings-btn');
      this.btnClose = document.getElementById('close-settings-btn');

      // Fields
      this.themeSelect = document.getElementById('setting-theme');
      this.fontFamilyInput = document.getElementById('setting-font-family');
      this.fontSizeInput = document.getElementById('setting-font-size');
      this.lineHeightInput = document.getElementById('setting-line-height');
      this.cursorStyleSelect = document.getElementById('setting-cursor-style');
      this.cursorBlinkCheck = document.getElementById('setting-cursor-blink');
      this.shellInput = document.getElementById('setting-shell');
      this.scrollbackInput = document.getElementById('setting-scrollback');
      this.mouseCopyCheck = document.getElementById('setting-mouse-copy');

      // Color Pickers Container
      this.customThemeContainer = document.getElementById('custom-theme-colors');
      
      // Core Colors
      this.colorBg = document.getElementById('color-bg');
      this.colorFg = document.getElementById('color-fg');
      this.colorCursor = document.getElementById('color-cursor');

      // ANSI Colors
      this.ansiBlack = document.getElementById('ansi-black');
      this.ansiRed = document.getElementById('ansi-red');
      this.ansiGreen = document.getElementById('ansi-green');
      this.ansiYellow = document.getElementById('ansi-yellow');
      this.ansiBlue = document.getElementById('ansi-blue');
      this.ansiMagenta = document.getElementById('ansi-magenta');
      this.ansiCyan = document.getElementById('ansi-cyan');
      this.ansiWhite = document.getElementById('ansi-white');
    }

    bindEvents() {
      this.btnOpen.addEventListener('click', () => this.open());
      this.btnClose.addEventListener('click', () => this.close());
      this.btnCancel.addEventListener('click', () => this.close());

      this.btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveConfig();
      });

      this.themeSelect.addEventListener('change', () => {
        if (this.themeSelect.value === 'custom') {
          this.customThemeContainer.classList.remove('hidden');
        } else {
          this.customThemeContainer.classList.add('hidden');
        }
      });

      ipcRenderer.on('menu-settings', () => this.open());
    }

    async loadConfig() {
      this.config = await ipcRenderer.invoke('get-config');
      this.populateFields();
    }

    populateFields() {
      if (!this.config) return;

      this.themeSelect.value = this.config.theme || 'spritex-dark';
      this.fontFamilyInput.value = this.config.font.family || 'Noto Sans Mono';
      this.fontSizeInput.value = this.config.font.size || 14;
      this.lineHeightInput.value = this.config.font.lineHeight || 1.4;
      this.cursorStyleSelect.value = this.config.cursor.style || 'block';
      this.cursorBlinkCheck.checked = !!this.config.cursor.blink;
      this.shellInput.value = this.config.shell || '/bin/zsh';
      this.scrollbackInput.value = this.config.scrollback || 10000;
      this.mouseCopyCheck.checked = !!this.config.mouseSelectCopy;

      if (this.config.theme === 'custom') {
        this.customThemeContainer.classList.remove('hidden');
      } else {
        this.customThemeContainer.classList.add('hidden');
      }

      const ct = this.config.customTheme || {};
      this.colorBg.value = ct.background || '#0d1117';
      this.colorFg.value = ct.foreground || '#e6edf3';
      this.colorCursor.value = ct.cursor || '#58a6ff';

      this.ansiBlack.value = ct.black || '#484f58';
      this.ansiRed.value = ct.red || '#ff7b72';
      this.ansiGreen.value = ct.green || '#3fb950';
      this.ansiYellow.value = ct.yellow || '#d29922';
      this.ansiBlue.value = ct.blue || '#58a6ff';
      this.ansiMagenta.value = ct.magenta || '#bc8cff';
      this.ansiCyan.value = ct.cyan || '#39c5cf';
      this.ansiWhite.value = ct.white || '#b1bac4';
    }

    open() {
      this.loadConfig().then(() => {
        this.drawer.classList.remove('hidden');
      });
    }

    close() {
      this.drawer.classList.add('hidden');
    }

    async saveConfig() {
      const customTheme = {
        background: this.colorBg.value,
        foreground: this.colorFg.value,
        cursor: this.colorCursor.value,
        black: this.ansiBlack.value,
        red: this.ansiRed.value,
        green: this.ansiGreen.value,
        yellow: this.ansiYellow.value,
        blue: this.ansiBlue.value,
        magenta: this.ansiMagenta.value,
        cyan: this.ansiCyan.value,
        white: this.ansiWhite.value,
        brightBlack: this.ansiBlack.value,
        brightRed: this.ansiRed.value,
        brightGreen: this.ansiGreen.value,
        brightYellow: this.ansiYellow.value,
        brightBlue: this.ansiBlue.value,
        brightMagenta: this.ansiMagenta.value,
        brightCyan: this.ansiCyan.value,
        brightWhite: this.ansiWhite.value
      };

      const newConfig = {
        theme: this.themeSelect.value,
        shell: this.shellInput.value,
        font: {
          family: this.fontFamilyInput.value,
          size: parseInt(this.fontSizeInput.value, 10),
          lineHeight: parseFloat(this.lineHeightInput.value)
        },
        cursor: {
          style: this.cursorStyleSelect.value,
          blink: this.cursorBlinkCheck.checked
        },
        scrollback: parseInt(this.scrollbackInput.value, 10),
        mouseSelectCopy: this.mouseCopyCheck.checked,
        customTheme: customTheme
      };

      const success = await ipcRenderer.invoke('save-config', newConfig);
      if (success) {
        this.config = newConfig;
        this.notifyConfigChange(newConfig);
        this.close();
      } else {
        alert("Failed to save configuration settings!");
      }
    }

    onConfigChange(callback) {
      this.onConfigChangeCallbacks.push(callback);
    }

    notifyConfigChange(newConfig) {
      for (const callback of this.onConfigChangeCallbacks) {
        try {
          callback(newConfig);
        } catch (e) {
          console.error("Config change listener failed:", e);
        }
      }
    }
  }

  window.settingsManager = new SettingsManager();
})();
