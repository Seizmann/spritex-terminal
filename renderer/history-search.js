(() => {
  const { ipcRenderer } = require('electron');

  class HistorySearch {
    constructor() {
      this.historyData = [];
      this.filteredData = [];
      this.selectedIndex = 0;
      this.onSelectCallback = null;
      this.initElements();
      this.bindEvents();
    }

    initElements() {
      this.modal = document.getElementById('history-modal');
      this.input = document.getElementById('history-search-input');
      this.list = document.getElementById('history-results-list');
      this.btnClose = document.getElementById('close-history-btn');
      this.btnOpenHeader = document.getElementById('history-btn');
    }

    bindEvents() {
      this.btnOpenHeader.addEventListener('click', () => this.open());
      this.btnClose.addEventListener('click', () => this.close());
      
      this.input.addEventListener('input', () => this.filterHistory());
      this.input.addEventListener('keydown', (e) => this.handleKeyboard(e));
      
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
          this.close();
          e.stopPropagation();
        }
      });

      ipcRenderer.on('menu-history-search', () => this.open());
    }

    async open(callback) {
      if (callback) {
        this.onSelectCallback = callback;
      }
      
      this.historyData = await ipcRenderer.invoke('read-history');
      this.selectedIndex = 0;
      this.input.value = '';
      this.filterHistory();
      this.modal.classList.remove('hidden');
      
      setTimeout(() => {
        this.input.focus();
      }, 50);
    }

    close() {
      this.modal.classList.add('hidden');
      if (window.activeTerminal) {
        window.activeTerminal.focus();
      }
    }

    filterHistory() {
      const query = this.input.value.toLowerCase().trim();
      if (!query) {
        this.filteredData = this.historyData.slice(0, 100);
      } else {
        this.filteredData = this.historyData.filter(cmd => {
          return cmd.toLowerCase().includes(query);
        }).slice(0, 100);
      }

      this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredData.length - 1));
      this.render();
    }

    render() {
      this.list.innerHTML = '';
      
      if (this.filteredData.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.className = 'history-item';
        emptyLi.style.textAlign = 'center';
        emptyLi.style.color = 'var(--text-dim)';
        emptyLi.textContent = 'No commands found';
        this.list.appendChild(emptyLi);
        return;
      }

      this.filteredData.forEach((cmd, idx) => {
        const li = document.createElement('li');
        li.className = `history-item ${idx === this.selectedIndex ? 'selected' : ''}`;
        li.textContent = cmd;
        
        li.addEventListener('mouseover', () => {
          this.selectedIndex = idx;
          this.updateSelectionStyles();
        });

        li.addEventListener('click', () => {
          this.confirmSelection();
        });

        this.list.appendChild(li);
      });

      const selectedEl = this.list.children[this.selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }

    updateSelectionStyles() {
      Array.from(this.list.children).forEach((li, idx) => {
        if (idx === this.selectedIndex) {
          li.classList.add('selected');
          li.scrollIntoView({ block: 'nearest' });
        } else {
          li.classList.remove('selected');
        }
      });
    }

    handleKeyboard(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredData.length;
        this.updateSelectionStyles();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredData.length) % this.filteredData.length;
        this.updateSelectionStyles();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.confirmSelection();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    }

    confirmSelection() {
      const selectedCmd = this.filteredData[this.selectedIndex];
      if (selectedCmd) {
        if (this.onSelectCallback) {
          this.onSelectCallback(selectedCmd);
        } else if (window.activeTerminalSession) {
          window.activeTerminalSession.writeToPty(selectedCmd);
        }
        this.close();
      }
    }
  }

  window.historySearch = new HistorySearch();
})();
