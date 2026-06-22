const { app, BrowserWindow, ipcMain, Menu, MenuItem, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const configManager = require('./config-manager');
const ptyManager = require('./pty-manager');

let mainWindow = null;

function getStartupDirectory() {
  let targetDir = os.homedir();
  const args = process.argv;
  const startIndex = app.isPackaged ? 1 : 2;

  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    if (arg && !arg.startsWith('-') && fs.existsSync(arg)) {
      try {
        const stat = fs.statSync(arg);
        if (stat.isDirectory()) {
          targetDir = path.resolve(arg);
          break;
        } else if (stat.isFile()) {
          targetDir = path.resolve(path.dirname(arg));
          break;
        }
      } catch (e) {}
    }
  }
  return targetDir;
}

function createWindow() {
  const config = configManager.get();
  const windowState = config.window || {};

  mainWindow = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x !== null ? windowState.x : undefined,
    y: windowState.y !== null ? windowState.y : undefined,
    minWidth: 800,
    minHeight: 600,
    title: "Spritex Terminal",
    icon: path.join(__dirname, '../assets/icon.png'), // Explicit taskbar & window icon
    frame: true, // Use native window frame for Mint/Cinnamon styling integration
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allows easy IPC and direct node features in renderer
      devTools: true
    }
  });

  // Load the renderer file
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Custom main menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow.webContents.send('menu-new-tab')
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('menu-open-folder', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow.webContents.send('menu-close-tab')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => mainWindow.webContents.send('menu-copy')
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+Shift+V',
          click: () => mainWindow.webContents.send('menu-paste')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu-settings')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Save window dimensions and coordinates on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      configManager.save({
        window: {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y
        }
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    ptyManager.killAll();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// IPC HANDLERS - Communication with Renderer
// ==========================================

// Get settings config
ipcMain.handle('get-config', () => {
  return configManager.get();
});

// Get command line startup folder path
ipcMain.handle('get-startup-directory', () => {
  return getStartupDirectory();
});

// Show native select folder dialog
ipcMain.handle('select-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Save settings config
ipcMain.handle('save-config', (event, newConfig) => {
  return configManager.save(newConfig);
});

// PTY lifecycle
ipcMain.handle('pty-create', (event, { id, cols, rows, cwd }) => {
  ptyManager.create(id, cols, rows, cwd, event.sender);
  return true;
});

ipcMain.on('pty-write', (event, { id, data }) => {
  ptyManager.write(id, data);
});

ipcMain.on('pty-resize', (event, { id, cols, rows }) => {
  ptyManager.resize(id, cols, rows);
});

ipcMain.on('pty-kill', (event, { id }) => {
  ptyManager.kill(id);
});

ipcMain.handle('get-pty-cwd', (event, { id }) => {
  return ptyManager.getCwd(id);
});

// Parse zsh and bash command history
ipcMain.handle('read-history', async () => {
  const home = os.homedir();
  const zshHistoryPath = path.join(home, '.zsh_history');
  const bashHistoryPath = path.join(home, '.bash_history');
  const history = [];
  const seen = new Set();

  const addCmd = (cmd) => {
    cmd = cmd.trim();
    if (cmd && !seen.has(cmd)) {
      seen.add(cmd);
      history.push(cmd);
    }
  };

  // Attempt to parse zsh history (contains binary/meta characters or timestamp prefixes sometimes)
  try {
    if (fs.existsSync(zshHistoryPath)) {
      const data = fs.readFileSync(zshHistoryPath, 'utf-8');
      const lines = data.split('\n');
      // Read from end to get recent commands first
      for (let i = lines.length - 1; i >= 0; i--) {
        let line = lines[i];
        if (line.includes(';')) {
          const idx = line.indexOf(';');
          addCmd(line.substring(idx + 1));
        } else {
          addCmd(line);
        }
      }
    }
  } catch (e) {
    console.error("Error reading zsh history:", e);
  }

  // Attempt to parse bash history
  try {
    if (fs.existsSync(bashHistoryPath)) {
      const data = fs.readFileSync(bashHistoryPath, 'utf-8');
      const lines = data.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        addCmd(lines[i]);
      }
    }
  } catch (e) {
    console.error("Error reading bash history:", e);
  }

  return history.slice(0, 1000); // Send back top 1000 unique commands
});

// Read directory files for autocomplete matches
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath);
    return files.map(file => {
      const fullPath = path.join(dirPath, file);
      let isDirectory = false;
      try {
        isDirectory = fs.statSync(fullPath).isDirectory();
      } catch (e) {}
      return { name: file, isDirectory };
    });
  } catch (e) {
    console.error("Error reading directory:", e);
    return [];
  }
});

// Context Menu (Right Click Copy / Paste)
ipcMain.on('show-context-menu', (event) => {
  const menu = new Menu();
  menu.append(new MenuItem({
    label: 'Copy',
    accelerator: 'CmdOrCtrl+Shift+C',
    click: () => event.sender.send('menu-copy')
  }));
  menu.append(new MenuItem({
    label: 'Paste',
    accelerator: 'CmdOrCtrl+Shift+V',
    click: () => event.sender.send('menu-paste')
  }));
  menu.append(new MenuItem({ type: 'separator' }));
  menu.append(new MenuItem({
    label: 'Select All',
    click: () => event.sender.send('menu-select-all')
  }));
  menu.popup(BrowserWindow.fromWebContents(event.sender));
});
