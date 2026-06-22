(() => {
  const { ipcRenderer } = require('electron');

  class AutocompleteManager {
    constructor() {
      this.isOpen = false;
      this.suggestions = [];
      this.selectedIndex = 0;
      this.currentWord = '';
      this.activeTabId = null;
      this.activeTerminal = null;
      
      this.initElements();
      this.bindEvents();
    }

    initElements() {
      this.popup = document.getElementById('autocomplete-popup');
      this.list = document.getElementById('autocomplete-list');
    }

    bindEvents() {
      document.addEventListener('click', (e) => {
        if (!this.popup.contains(e.target)) {
          this.close();
        }
      });
    }

    attach(tabId, terminal) {
      this.activeTabId = tabId;
      this.activeTerminal = terminal;
      this.close();
    }

    handleKeyDown(e) {
      if (!this.isOpen) {
        if (e.key === 'Tab' || (e.ctrlKey && e.key === ' ')) {
          this.triggerAutocomplete();
          return true;
        }
        return false;
      }

      if (e.key === 'ArrowDown') {
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        this.updateSelection();
        return true;
      } else if (e.key === 'ArrowUp') {
        this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.updateSelection();
        return true;
      } else if (e.key === 'Tab') {
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        this.updateSelection();
        return true;
      } else if (e.key === 'Enter') {
        this.confirmSelection();
        return true;
      } else if (e.key === 'Escape') {
        this.close();
        return true;
      }

      return false;
    }

    async triggerAutocomplete() {
      if (!this.activeTerminal || !this.activeTabId) return;

      const term = this.activeTerminal;
      const cursorX = term.buffer.active.cursorX;
      const cursorY = term.buffer.active.cursorY;
      const lineIndex = cursorY + term.buffer.active.baseY;
      const activeLine = term.buffer.active.getLine(lineIndex);
      
      if (!activeLine) return;
      
      const lineText = activeLine.translateToString(true);
      const prefix = lineText.substring(0, cursorX);
      
      const words = prefix.split(/[\s;|]/);
      this.currentWord = words[words.length - 1] || '';
      
      const cwd = await ipcRenderer.invoke('get-pty-cwd', { id: this.activeTabId });
      const history = await ipcRenderer.invoke('read-history');
      
      let pathSuggestions = [];
      if (cwd) {
        const files = await ipcRenderer.invoke('read-directory', cwd);
        pathSuggestions = files
          .filter(f => f.name.toLowerCase().startsWith(this.currentWord.toLowerCase()))
          .map(f => ({
            text: f.name + (f.isDirectory ? '/' : ''),
            type: f.isDirectory ? 'dir' : 'file'
          }));
      }

      const historySuggestions = history
        .filter(cmd => cmd.toLowerCase().startsWith(this.currentWord.toLowerCase()) && cmd !== this.currentWord)
        .slice(0, 10)
        .map(cmd => ({
          text: cmd,
          type: 'history'
        }));

      this.suggestions = [...pathSuggestions, ...historySuggestions].slice(0, 8);

      if (this.suggestions.length === 0) {
        this.close();
        ipcRenderer.send('pty-write', { id: this.activeTabId, data: '\t' });
        return;
      }

      if (this.suggestions.length === 1) {
        this.selectedIndex = 0;
        this.confirmSelection();
        return;
      }

      this.selectedIndex = 0;
      this.positionPopup();
      this.render();
      this.isOpen = true;
    }

    positionPopup() {
      if (!this.activeTerminal) return;

      const term = this.activeTerminal;
      const element = term.element;
      const rect = element.getBoundingClientRect();
      
      let cellWidth = 9;
      let cellHeight = 17;
      
      try {
        const dimensions = term._core._renderService.dimensions;
        if (dimensions && dimensions.css && dimensions.css.cell) {
          cellWidth = dimensions.css.cell.width;
          cellHeight = dimensions.css.cell.height;
        }
      } catch (e) {}

      const cursorX = term.buffer.active.cursorX;
      const cursorY = term.buffer.active.cursorY;
      
      let left = rect.left + 12 + (cursorX * cellWidth);
      let top = rect.top + 12 + ((cursorY + 1) * cellHeight);

      if (left + 300 > window.innerWidth) {
        left = window.innerWidth - 320;
      }
      if (top + 250 > window.innerHeight) {
        top = rect.top + 12 + (cursorY * cellHeight) - 200;
      }

      this.popup.style.left = `${left}px`;
      this.popup.style.top = `${top}px`;
    }

    render() {
      this.list.innerHTML = '';
      
      this.suggestions.forEach((sug, idx) => {
        const li = document.createElement('li');
        li.className = `autocomplete-item ${idx === this.selectedIndex ? 'selected' : ''}`;
        
        let iconSvg = '';
        if (sug.type === 'dir') {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="item-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        } else if (sug.type === 'file') {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="item-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
        } else {
          iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="item-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        }

        li.innerHTML = `${iconSvg} <span>${sug.text}</span>`;
        
        li.addEventListener('click', () => {
          this.selectedIndex = idx;
          this.confirmSelection();
        });

        this.list.appendChild(li);
      });

      this.popup.classList.remove('hidden');
    }

    updateSelection() {
      Array.from(this.list.children).forEach((li, idx) => {
        if (idx === this.selectedIndex) {
          li.classList.add('selected');
          li.scrollIntoView({ block: 'nearest' });
        } else {
          li.classList.remove('selected');
        }
      });
    }

    confirmSelection() {
      const selection = this.suggestions[this.selectedIndex];
      if (selection && this.activeTabId) {
        let completedText = selection.text;
        
        if (selection.type === 'file' || selection.type === 'dir') {
          completedText = completedText.replace(/([\s()\[\]{}*?#~$^&|\\<>])/g, '\\$1');
        }

        const suffix = completedText.substring(this.currentWord.length);
        ipcRenderer.send('pty-write', { id: this.activeTabId, data: suffix });
      }
      this.close();
    }

    close() {
      this.popup.classList.add('hidden');
      this.isOpen = false;
    }
  }

  window.autocompleteManager = new AutocompleteManager();
})();
