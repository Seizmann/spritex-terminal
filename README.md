# 🚀 Spritex Terminal

<p align="center">
  <img src="assets/icon.png" width="160" height="160" alt="Spritex Terminal Logo">
</p>

<p align="center">
  <strong>A modern, native desktop terminal emulator built on Electron and xterm.js designed for developers using AI agents who require perfect, unbroken Unicode/Bengali/Banglish font rendering out-of-the-box.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Linux%20(Mint/Ubuntu/Debian)-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

---

## 🔍 The Problem & The Solution

**The Problem:** Standard Linux terminal emulators (especially on Cinnamon, XFCE, or non-GNOME environments) break complex script layouts like Bengali or Arabic. The character-cell grid system splits combining vowel marks (`ি`, `া`, `ো`) and conjuncts (`ক্ষ`, `শ্য`) into separate cells, resulting in jarring dotted circles and detached letters when AI agents (like Claude Code) print Bengali output.

**The Solution:** Spritex Terminal wraps a robust backend process with a Chromium-powered window layer. It uses a custom **real-time DOM rendering interceptor** that parses lines from the terminal buffer. When a line contains Bengali text:
1. It bypasses the standard absolute monospace cell grid mapping.
2. It dynamically segments the line: shapes Bengali text inside a proportional inline `Noto Sans Bengali` container, while maintaining standard pixel-perfect monospace coordinates (`Noto Sans Mono` / fallback) for English ASCII letters, symbols, and numbers.
3. This forces the browser's native text shaping engine to render complex scripts perfectly.

---

## ✨ Features

- **Perfect Unicode Shaping:** 100% correct, joined, and shaped Bengali letters and combining vowel positions.
- **Dynamic Mixed-Script Monospace:** Non-Bengali characters (English, numbers, brackets, punctuation) are aligned cell-by-cell down to the exact decimal pixel to ensure perfect column formatting.
- **Premium Tabbed Interface:** Open multiple independent shell sessions (`Ctrl+T` / `Ctrl+W` / `Ctrl+Tab`).
- **Nemo Context Menu Action:** Right-click a directory in Linux Mint's file manager and click **"Open in Spritex Terminal"** to launch it instantly in that path.
- **Fuzzy Command History:** Press `Ctrl+R` to search your command logs (`.zsh_history` / `.bash_history`) in a sleek, glassmorphic modal overlays.
- **Smart Autocomplete:** Access floating suggestions for folders, files, and recent history directly under the cursor by pressing `Tab`.
- **Customizable Theming System:** Seamlessly configure font styles, cursor blink behaviors, and colors via the sliding settings panel (`Ctrl+,`). Ships with *Spritex Dark*, *Minimal Dark*, and *Solarized Dark* themes.

---

## 🛠️ Tech Stack

- **Framework:** Electron (HTML5/CSS/Node.js)
- **Frontend Terminal Engine:** `@xterm/xterm` (DOM renderer mode)
- **Native Spawn Process Interface:** `node-pty`
- **Auto-builder Tool:** `electron-builder`
- **Styling System:** Vanilla CSS (Glassmorphism, gradients, HSL custom tokens, micro-animations)

---

## 🚀 Installation & Running

### Debian / Ubuntu / Linux Mint
You can build the installable `.deb` package directly:

```bash
# Clone the repository
git clone https://github.com/spritexai/spritex-terminal.git
cd spritex-terminal

# Install dependencies
npm install

# Build the Debian package
npm run build

# Install the generated package
sudo dpkg -i dist/spritex-terminal_1.0.0_amd64.deb
sudo apt-get install -f
```

Once installed, simply search for **Spritex Terminal** in your Application Menu, or execute `spritex-terminal` from any command line prompt.

---

## 📁 Repository Structure

```
spritex-terminal/
├── assets/                  # App assets (bundled Noto Sans fonts & icons)
├── main/                    # Electron backend main process files
│   ├── main.js              # Main application entry point & IPC listeners
│   ├── config-manager.js    # Load, validate & write config.json parameters
│   └── pty-manager.js       # Spawn, size & close node-pty shell sessions
├── renderer/                # Visual components renderer files (Frontend)
│   ├── index.html           # Main DOM structure
│   ├── index.css            # Stylesheets (colors, layout variables & transitions)
│   ├── terminal.js          # Reconstructs layout rows & shapes complex scripts
│   ├── tabs.js              # Controls terminal tabs & workspace tracking
│   ├── settings.js          # Handles settings drawer forms & config syncs
│   ├── autocomplete.js      # Suggests commands & files under active cursors
│   ├── history-search.js    # Fuzzy filter overlay for command histories
│   └── themes.js            # Defines default theme color maps
├── package.json             # NPM metadata & execution commands
└── electron-builder.yml     # Configuration for packaging the .deb build
```

---

## 🤝 Contributing

Contributions, bug reports, and features suggestions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
