const pty = require('node-pty');
const configManager = require('./config-manager');
const fs = require('fs');
const os = require('os');

class PtyManager {
  constructor() {
    this.sessions = new Map();
  }

  create(id, cols, rows, cwd, webContents) {
    const config = configManager.get();
    const shell = config.shell;
    
    const env = Object.assign({}, process.env, {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    });

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: cwd || process.env.HOME || os.homedir(),
      env: env
    });

    this.sessions.set(id, ptyProcess);

    ptyProcess.onData(data => {
      if (!webContents.isDestroyed()) {
        webContents.send(`pty-data-${id}`, data);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(id);
      if (!webContents.isDestroyed()) {
        webContents.send(`pty-exit-${id}`, { exitCode, signal });
      }
    });

    return ptyProcess;
  }

  write(id, data) {
    const ptyProcess = this.sessions.get(id);
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  }

  resize(id, cols, rows) {
    const ptyProcess = this.sessions.get(id);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch (e) {
        console.error(`Error resizing pty ${id}:`, e);
      }
    }
  }

  kill(id) {
    const ptyProcess = this.sessions.get(id);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (e) {
        console.error(`Error killing pty ${id}:`, e);
      }
      this.sessions.delete(id);
    }
  }

  getCwd(id) {
    const ptyProcess = this.sessions.get(id);
    if (ptyProcess && ptyProcess.pid) {
      try {
        // Read directory link in /proc/<pid>/cwd on Linux
        return fs.readlinkSync(`/proc/${ptyProcess.pid}/cwd`);
      } catch (e) {
        // Fallback if proc filesystem is not readable or process terminated
        return null;
      }
    }
    return null;
  }

  killAll() {
    for (const id of this.sessions.keys()) {
      this.kill(id);
    }
  }
}

module.exports = new PtyManager();
