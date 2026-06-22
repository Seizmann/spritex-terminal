(() => {
  const { ipcRenderer } = require('electron');
  const path = require('path');
  const os = require('os');

  class TabManager {
    constructor() {
      this.tabs = [];
      this.activeTabId = null;
      this.initElements();
      this.bindEvents();
      
      setInterval(() => this.updateTabTitlesFromCwd(), 2000);
    }

    initElements() {
      this.container = document.getElementById('tabs-container');
      this.btnAdd = document.getElementById('add-tab-btn');
      this.btnOpenFolder = document.getElementById('open-folder-btn');
      this.terminalContainer = document.getElementById('terminal-container');
    }

    bindEvents() {
      this.btnAdd.addEventListener('click', () => this.addTab());
      
      this.btnOpenFolder.addEventListener('click', async () => {
        const folderPath = await ipcRenderer.invoke('select-folder-dialog');
        if (folderPath) this.addTab(folderPath);
      });

      ipcRenderer.on('menu-new-tab', () => this.addTab());
      
      ipcRenderer.on('menu-open-folder', (event, folderPath) => {
        if (folderPath) this.addTab(folderPath);
      });

      ipcRenderer.on('menu-close-tab', () => {
        if (this.activeTabId) this.closeTab(this.activeTabId);
      });

      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
          e.preventDefault();
          this.addTab();
        } else if (e.ctrlKey && e.key === 'o') {
          e.preventDefault();
          this.btnOpenFolder.click();
        } else if (e.ctrlKey && e.key === 'w') {
          e.preventDefault();
          if (this.activeTabId) this.closeTab(this.activeTabId);
        } else if (e.ctrlKey && e.key === 'Tab') {
          e.preventDefault();
          if (this.tabs.length > 1) {
            if (e.shiftKey) {
              this.cycleTab(-1);
            } else {
              this.cycleTab(1);
            }
          }
        }
      });
    }

    async addTab(cwd = null) {
      const id = `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const tabEl = document.createElement('div');
      tabEl.className = 'tab';
      tabEl.id = `tab-item-${id}`;
      tabEl.innerHTML = `
        <span class="tab-title" id="tab-title-${id}">zsh</span>
        <button class="tab-close-btn" id="tab-close-${id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      const wrapEl = document.createElement('div');
      wrapEl.className = 'terminal-wrapper';
      wrapEl.id = `term-wrapper-${id}`;

      this.terminalContainer.appendChild(wrapEl);
      this.container.appendChild(tabEl);

      const session = new window.TerminalSession(id, wrapEl);
      
      const tabObj = {
        id,
        tabEl,
        wrapEl,
        session,
        title: 'zsh',
        customTitle: false
      };

      this.tabs.push(tabObj);

      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        this.setActiveTab(id);
      });

      tabEl.querySelector('.tab-close-btn').addEventListener('click', () => {
        this.closeTab(id);
      });

      tabEl.querySelector('.tab-title').addEventListener('dblclick', () => {
        this.renameTab(id);
      });

      setTimeout(async () => {
        await session.init(cwd);
        this.setActiveTab(id);
      }, 50);
    }

    closeTab(id) {
      const idx = this.tabs.findIndex(t => t.id === id);
      if (idx === -1) return;

      const tab = this.tabs[idx];
      tab.session.destroy();
      
      tab.tabEl.remove();
      tab.wrapEl.remove();

      this.tabs.splice(idx, 1);

      if (this.activeTabId === id) {
        if (this.tabs.length > 0) {
          const nextActiveIdx = Math.min(idx, this.tabs.length - 1);
          this.setActiveTab(this.tabs[nextActiveIdx].id);
        } else {
          this.activeTabId = null;
          window.activeTerminal = null;
          window.activeTerminalSession = null;
          this.addTab();
        }
      }
    }

    setActiveTab(id) {
      const tab = this.tabs.find(t => t.id === id);
      if (!tab) return;

      this.activeTabId = id;
      window.activeTerminal = tab.session.terminal;
      window.activeTerminalSession = tab.session;

      if (window.autocompleteManager) {
        window.autocompleteManager.attach(id, tab.session.terminal);
      }

      this.tabs.forEach(t => {
        if (t.id === id) {
          t.tabEl.classList.add('active');
          t.wrapEl.classList.add('active');
        } else {
          t.tabEl.classList.remove('active');
          t.wrapEl.classList.remove('active');
        }
      });

      setTimeout(() => {
        tab.session.terminal.focus();
        tab.session.fit();
      }, 10);

      this.updateWindowTitle(tab);
    }

    cycleTab(dir) {
      const idx = this.tabs.findIndex(t => t.id === this.activeTabId);
      if (idx === -1) return;
      
      const nextIdx = (idx + dir + this.tabs.length) % this.tabs.length;
      this.setActiveTab(this.tabs[nextIdx].id);
    }

    renameTab(id) {
      const tab = this.tabs.find(t => t.id === id);
      if (!tab) return;

      const titleEl = tab.tabEl.querySelector('.tab-title');
      const oldText = titleEl.textContent;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tab-rename-input';
      input.value = oldText;
      input.style.width = '100%';
      input.style.border = 'none';
      input.style.background = 'transparent';
      input.style.color = 'var(--text-main)';
      input.style.fontFamily = 'var(--font-ui)';
      input.style.fontSize = '12px';
      input.style.outline = 'none';

      titleEl.replaceWith(input);
      input.focus();
      input.select();

      const commitRename = () => {
        const val = input.value.trim();
        const span = document.createElement('span');
        span.className = 'tab-title';
        span.id = `tab-title-${id}`;
        span.textContent = val || oldText;
        
        tab.title = val || oldText;
        tab.customTitle = !!val;
        
        input.replaceWith(span);
        span.addEventListener('dblclick', () => this.renameTab(id));
        this.updateWindowTitle(tab);
      };

      input.addEventListener('blur', commitRename);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          input.removeEventListener('blur', commitRename);
          commitRename();
        } else if (e.key === 'Escape') {
          input.removeEventListener('blur', commitRename);
          const span = document.createElement('span');
          span.className = 'tab-title';
          span.id = `tab-title-${id}`;
          span.textContent = oldText;
          input.replaceWith(span);
          span.addEventListener('dblclick', () => this.renameTab(id));
        }
      });
    }

    async updateTabTitlesFromCwd() {
      for (const tab of this.tabs) {
        if (tab.customTitle) continue;

        const cwd = await ipcRenderer.invoke('get-pty-cwd', { id: tab.id });
        if (cwd) {
          const folderName = cwd === os.homedir() ? '~' : path.basename(cwd);
          const titleEl = document.getElementById(`tab-title-${tab.id}`);
          if (titleEl && titleEl.textContent !== folderName) {
            titleEl.textContent = folderName;
            tab.title = folderName;
            if (this.activeTabId === tab.id) {
              this.updateWindowTitle(tab);
            }
          }
        }
      }
    }

    updateWindowTitle(tab) {
      document.title = `Spritex Terminal — ${tab.title}`;
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    window.tabManager = new TabManager();
    const startDir = await ipcRenderer.invoke('get-startup-directory');
    window.tabManager.addTab(startDir);
  });
})();
