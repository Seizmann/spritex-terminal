(() => {
  const { Terminal } = require('@xterm/xterm');
  const { FitAddon } = require('@xterm/addon-fit');
  const { WebLinksAddon } = require('@xterm/addon-web-links');
  const { ipcRenderer, clipboard } = require('electron');

  class TerminalSession {
    constructor(id, container) {
      this.id = id;
      this.container = container;
      this.terminal = null;
      this.fitAddon = null;
      this.config = null;
      this.domObserver = null;
      
      this.ptyDataListener = (event, data) => {
        if (this.terminal) this.terminal.write(data);
      };
      
      this.ptyExitListener = (event, { exitCode, signal }) => {
        console.log(`PTY Session exited: ${exitCode} / signal: ${signal}`);
        if (window.tabManager) {
          window.tabManager.closeTab(this.id);
        }
      };

      this.copyListener = () => this.copySelection();
      this.pasteListener = () => this.pasteFromClipboard();
      this.selectAllListener = () => {
        if (this.terminal) this.terminal.selectAll();
      };

      this.zoomInListener = () => this.changeFontSize(1);
      this.zoomOutListener = () => this.changeFontSize(-1);
      this.zoomResetListener = () => this.changeFontSize(0);
    }

    async init(cwd = null) {
      this.config = await ipcRenderer.invoke('get-config');
      const termOptions = this.getTerminalOptions(this.config);

      this.terminal = new Terminal(termOptions);
      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);
      this.terminal.loadAddon(new WebLinksAddon());

      this.terminal.open(this.container);
      this.fitAddon.fit();

      const cols = this.terminal.cols;
      const rows = this.terminal.rows;

      await ipcRenderer.invoke('pty-create', { id: this.id, cols, rows, cwd });

      this.terminal.onData(data => {
        ipcRenderer.send('pty-write', { id: this.id, data });
      });

      this.terminal.attachCustomKeyEventHandler(e => {
        if (e.type === 'keydown' && window.autocompleteManager) {
          const handled = window.autocompleteManager.handleKeyDown(e);
          if (handled) return false;
        }
        return true;
      });

      // Bind incoming shell data
      ipcRenderer.on(`pty-data-${this.id}`, this.ptyDataListener);
      ipcRenderer.on(`pty-exit-${this.id}`, this.ptyExitListener);

      ipcRenderer.on('menu-copy', this.copyListener);
      ipcRenderer.on('menu-paste', this.pasteListener);
      ipcRenderer.on('menu-select-all', this.selectAllListener);

      ipcRenderer.on('menu-zoom-in', this.zoomInListener);
      ipcRenderer.on('menu-zoom-out', this.zoomOutListener);
      ipcRenderer.on('menu-zoom-reset', this.zoomResetListener);

      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.container);

      this.terminal.onSelectionChange(() => {
        if (this.config.mouseSelectCopy && this.terminal.hasSelection()) {
          const selectionText = this.terminal.getSelection();
          clipboard.writeText(selectionText);
        }
      });

      this.container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ipcRenderer.send('show-context-menu');
      });

      // Hook render event to fix complex Unicode/Bengali shaping.
      this.terminal.onRender(e => {
        const rowsContainer = this.container.querySelector('.xterm-rows');
        if (rowsContainer) {
          const rowElements = rowsContainer.children;
          const viewportY = this.terminal.buffer.active.viewportY;
          for (let i = e.start; i <= e.end; i++) {
            const rowEl = rowElements[i];
            if (rowEl) {
              const lineIndex = viewportY + i;
              this.reRenderRowIfBengali(lineIndex, rowEl);
            }
          }
        }
      });

      // Set up MutationObserver to catch any ad-hoc DOM modifications by xterm.js
      setTimeout(() => {
        const rowsContainer = this.container.querySelector('.xterm-rows');
        if (rowsContainer) {
          this.domObserver = new MutationObserver(() => {
            this.domObserver.disconnect();
            
            const rowElements = rowsContainer.children;
            const viewportY = this.terminal.buffer.active.viewportY;
            for (let i = 0; i < rowElements.length; i++) {
              const rowEl = rowElements[i];
              if (rowEl) {
                const lineIndex = viewportY + i;
                this.reRenderRowIfBengali(lineIndex, rowEl);
              }
            }
            
            this.domObserver.observe(rowsContainer, { childList: true, subtree: true, characterData: true });
          });
          
          this.domObserver.observe(rowsContainer, { childList: true, subtree: true, characterData: true });
        }
      }, 500);

      if (window.settingsManager) {
        window.settingsManager.onConfigChange((newConfig) => {
          this.config = newConfig;
          this.applySettings(newConfig);
        });
      }
    }

    // Shapes Bengali blocks with layout fonts while rendering English characters
    // cell-by-cell at exact pixel column alignments matching xterm's grid.
    shapeBengaliText(text, cellWidth) {
      const regex = /([\u0980-\u09ff]+)/g;
      const parts = text.split(regex);
      
      let result = '';
      for (const part of parts) {
        if (/[\u0980-\u09ff]/.test(part)) {
          // Render Bengali block as a single styled inline span for proper shaping
          result += `<span style="font-family: 'Noto Sans Bengali', sans-serif; display: inline-block; vertical-align: bottom;">${this.escapeHtml(part)}</span>`;
        } else {
          // Render English/symbol characters cell-by-cell to align with monospace columns
          for (let i = 0; i < part.length; i++) {
            const char = part[i];
            if (char === ' ') {
              result += `<span style="display: inline-block; width: ${cellWidth}px;">&nbsp;</span>`;
            } else {
              result += `<span style="display: inline-block; width: ${cellWidth}px; text-align: center;">${this.escapeHtml(char)}</span>`;
            }
          }
        }
      }
      return result;
    }

    // Re-renders a terminal DOM row dynamically if it contains Bengali characters
    reRenderRowIfBengali(lineIndex, rowEl) {
      const line = this.terminal.buffer.active.getLine(lineIndex);
      if (!line) return;
      const lineText = line.translateToString(true);
      
      // Match Bengali Unicode block (U+0980 - U+09FF)
      if (/[\u0980-\u09ff]/.test(lineText)) {
        // Calculate cellWidth dynamically by dividing container width by cols.
        // Falls back to checking internal renderer service dimensions, then hardcoded 9.6px.
        let cellWidth = 9.6;
        try {
          const rect = rowEl.getBoundingClientRect();
          if (rect && rect.width > 0) {
            cellWidth = rect.width / this.terminal.cols;
          } else {
            const dimensions = this.terminal._core._renderService.dimensions;
            if (dimensions && dimensions.css && dimensions.css.cell) {
              cellWidth = dimensions.css.cell.width;
            }
          }
        } catch (e) {}

        let html = '';
        let currentText = '';
        let lastStyles = null;

        const stylesEqual = (s1, s2) => {
          if (!s1 || !s2) return false;
          return s1.fg === s2.fg &&
                 s1.bg === s2.bg &&
                 s1.bold === s2.bold &&
                 s1.italic === s2.italic &&
                 s1.underline === s2.underline;
        };

        const flush = () => {
          if (currentText) {
            if (lastStyles) {
              let styleStr = '';
              if (lastStyles.fg !== -1) {
                styleStr += `color: ${this.resolveColor(lastStyles.fg, true)};`;
              }
              if (lastStyles.bg !== -1) {
                styleStr += `background-color: ${this.resolveColor(lastStyles.bg, false)};`;
              }
              if (lastStyles.bold) styleStr += 'font-weight: bold;';
              if (lastStyles.italic) styleStr += 'font-style: italic;';
              if (lastStyles.underline) styleStr += 'text-decoration: underline;';
              
              if (styleStr) {
                html += `<span style="${styleStr}">${this.shapeBengaliText(currentText, cellWidth)}</span>`;
              } else {
                html += this.shapeBengaliText(currentText, cellWidth);
              }
            } else {
              html += this.shapeBengaliText(currentText, cellWidth);
            }
            currentText = '';
          }
        };

        for (let c = 0; c < line.length; c++) {
          const cell = line.getCell(c);
          if (!cell) continue;

          if (cell.getWidth() === 0 && c > 0) {
            continue;
          }

          const char = cell.getChars();
          const styles = {
            fg: cell.getFgColor(),
            bg: cell.getBgColor(),
            bold: cell.isBold(),
            italic: cell.isItalic(),
            underline: cell.isUnderline()
          };

          if (!stylesEqual(styles, lastStyles)) {
            flush();
            lastStyles = styles;
          }
          
          currentText += char || ' ';
        }
        flush();

        // Inject shaped row HTML, outer fallback is standard mono font
        rowEl.innerHTML = `<span style="font-family: var(--font-mono); white-space: pre; display: inline-block; width: 100%;">${html}</span>`;
      }
    }

    resolveColor(colorValue, isFg) {
      const themeName = this.config.theme;
      let themeColors = {};
      
      if (themeName === 'custom') {
        themeColors = this.config.customTheme || {};
      } else if (window.themes && window.themes[themeName]) {
        themeColors = window.themes[themeName];
      }
      
      const ansiKeys = [
        'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
        'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite'
      ];

      // Standard ANSI colors
      if (colorValue >= 0 && colorValue < 16) {
        const key = ansiKeys[colorValue];
        return themeColors[key] || (isFg ? '#ffffff' : '#000000');
      }

      // 6x6x6 color cube
      if (colorValue >= 16 && colorValue <= 231) {
        const index = colorValue - 16;
        const r = Math.floor(index / 36) * 51;
        const g = Math.floor((index % 36) / 6) * 51;
        const b = (index % 6) * 51;
        return `rgb(${r},${g},${b})`;
      }

      // Grayscale ramp
      if (colorValue >= 232 && colorValue <= 255) {
        const gray = (colorValue - 232) * 10 + 8;
        return `rgb(${gray},${gray},${gray})`;
      }

      // Direct RGB
      if (colorValue > 16777215) {
        const r = (colorValue >> 16) & 0xff;
        const g = (colorValue >> 8) & 0xff;
        const b = colorValue & 0xff;
        return `rgb(${r},${g},${b})`;
      }

      return isFg ? 'var(--text-main)' : 'var(--bg-primary)';
    }

    escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    getTerminalOptions(config) {
      let xtermTheme = {};
      const themeName = config.theme;
      
      if (themeName === 'custom') {
        xtermTheme = config.customTheme || {};
      } else if (window.themes && window.themes[themeName]) {
        xtermTheme = window.themes[themeName];
      }

      return {
        fontFamily: config.font.family,
        fontSize: config.font.size,
        lineHeight: config.font.lineHeight,
        cursorStyle: config.cursor.style,
        cursorBlink: config.cursor.blink,
        scrollback: config.scrollback,
        theme: xtermTheme,
        allowProposedApi: true
      };
    }

    applySettings(config) {
      if (!this.terminal) return;

      const options = this.getTerminalOptions(config);
      
      this.terminal.options.fontFamily = options.fontFamily;
      this.terminal.options.fontSize = options.fontSize;
      this.terminal.options.lineHeight = options.lineHeight;
      this.terminal.options.cursorStyle = options.cursorStyle;
      this.terminal.options.cursorBlink = options.cursorBlink;
      this.terminal.options.scrollback = options.scrollback;
      this.terminal.options.theme = options.theme;

      setTimeout(() => this.fit(), 50);
    }

    changeFontSize(direction) {
      if (!this.terminal || !this.config) return;
      
      let newSize = this.config.font.size;
      if (direction === 0) {
        newSize = 14;
      } else {
        newSize += direction;
      }
      
      newSize = Math.max(8, Math.min(newSize, 72));
      
      this.config.font.size = newSize;
      this.terminal.options.fontSize = newSize;
      
      ipcRenderer.invoke('save-config', { font: this.config.font });
      
      setTimeout(() => this.fit(), 50);
    }

    fit() {
      if (!this.terminal || !this.fitAddon) return;
      try {
        this.fitAddon.fit();
        const cols = this.terminal.cols;
        const rows = this.terminal.rows;
        ipcRenderer.send('pty-resize', { id: this.id, cols, rows });
      } catch (e) {
        console.error("Fit failed:", e);
      }
    }

    writeToPty(data) {
      ipcRenderer.send('pty-write', { id: this.id, data: data + '\r' });
    }

    copySelection() {
      if (this.terminal && this.terminal.hasSelection()) {
        clipboard.writeText(this.terminal.getSelection());
      }
    }

    pasteFromClipboard() {
      const text = clipboard.readText();
      ipcRenderer.send('pty-write', { id: this.id, data: text });
    }

    destroy() {
      if (this.domObserver) {
        this.domObserver.disconnect();
      }
      ipcRenderer.off(`pty-data-${this.id}`, this.ptyDataListener);
      ipcRenderer.off(`pty-exit-${this.id}`, this.ptyExitListener);
      ipcRenderer.off('menu-copy', this.copyListener);
      ipcRenderer.off('menu-paste', this.pasteListener);
      ipcRenderer.off('menu-select-all', this.selectAllListener);
      ipcRenderer.off('menu-zoom-in', this.zoomInListener);
      ipcRenderer.off('menu-zoom-out', this.zoomOutListener);
      ipcRenderer.off('menu-zoom-reset', this.zoomResetListener);

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      ipcRenderer.send('pty-kill', { id: this.id });

      if (this.terminal) {
        this.terminal.dispose();
      }
    }
  }

  window.TerminalSession = TerminalSession;
})();
