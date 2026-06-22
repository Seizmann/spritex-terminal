const os = require('os');
const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'spritex-terminal');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_THEME = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#58a6ff",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc"
};

function getDefaultShell() {
  if (process.env.SHELL) return process.env.SHELL;
  if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
  if (fs.existsSync('/bin/bash')) return '/bin/bash';
  return '/bin/sh';
}

const DEFAULT_CONFIG = {
  shell: getDefaultShell(),
  font: {
    family: "monospace",
    size: 14,
    lineHeight: 1.4
  },
  scrollback: 10000,
  mouseSelectCopy: true,
  cursor: {
    style: "block",
    blink: true
  },
  theme: "spritex-dark",
  customTheme: DEFAULT_THEME,
  window: {
    width: 1200,
    height: 800,
    x: null,
    y: null
  }
};

class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      if (!fs.existsSync(CONFIG_FILE)) {
        this.save(DEFAULT_CONFIG);
      } else {
        const rawData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(rawData);
        
        // Migrate legacy Noto Sans Mono setting to monospace to fix wide spacing
        if (parsed && parsed.font && parsed.font.family === 'Noto Sans Mono') {
          parsed.font.family = 'monospace';
        }

        // Deep merge config to make sure default properties are preserved
        this.config = this.deepMerge(DEFAULT_CONFIG, parsed);
        
        // Write the migrated config back to file
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
      }
    } catch (err) {
      console.error("Failed to load config, using defaults:", err);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  deepMerge(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }

  get() {
    return this.config;
  }

  save(newConfig) {
    try {
      this.config = this.deepMerge(this.config, newConfig);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error("Failed to save config:", err);
      return false;
    }
  }
}

module.exports = new ConfigManager();
