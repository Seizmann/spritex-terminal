# Contributing to Spritex Terminal

We are thrilled that you are interested in contributing to **Spritex Terminal**! This project was built to make terminal rendering for complex Indic languages (specifically Bengali) seamless and beautiful.

By contributing, you help make developers using non-Latin scripts more productive when working with command line environments and AI coding assistants.

---

## 🛠️ Setting Up Your Development Environment

To start contributing, follow these instructions to clone, install, and run the project locally:

1. **Prerequisites:**
   Ensure you have [Node.js](https://nodejs.org/) (v16+) and standard compiler tools installed (needed to rebuild native node-pty C++ bindings):
   ```bash
   # For Debian/Ubuntu/Linux Mint
   sudo apt install build-essential python3 make
   ```

2. **Clone & Install:**
   ```bash
   git clone https://github.com/spritexai/spritex-terminal.git
   cd spritex-terminal
   npm install
   ```

3. **Running the App in Dev Mode:**
   To launch the Electron GUI:
   ```bash
   npm run dev
   ```
   You can also specify a folder path to launch the terminal inside it:
   ```bash
   npx electron . /path/to/folder
   ```

---

## 💻 Contribution Workflow

1. **Fork the Repository:** Create a personal fork on GitHub.
2. **Create a Feature Branch:** Choose a descriptive branch name:
   ```bash
   git checkout -b feature/cool-new-feature
   ```
3. **Make Your Changes:** Focus on code readability, performance, and keeping the codebase cleanly modularized.
4. **Isolate Renderer Scopes:** If adding new javascript scripts to the frontend renderer (`renderer/`), wrap the contents inside an **IIFE** (Immediately Invoked Function Expression) to prevent global scope variable pollution or identifier collisions.
5. **Testing Your Code:**
   * Test rendering of mixed Bengali and English strings.
   * Ensure tab keybindings (`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`) function perfectly.
   * Verify settings changes apply in real-time.
   * Confirm the autocomplete popup appears cleanly below the cursor without overlaps.
6. **Submit a Pull Request (PR):** Describe your changes clearly in the PR description, linking any related issues.

---

## 📏 Code Style Guidelines

- **JavaScript:** Use clean ES6 syntax. Prefer asynchronous modules where applicable.
- **CSS:** Use variables (CSS custom properties) to specify themes. Keep layouts clean with Flexbox/Grid and use transitions for interactive states.
- **Pty Data Streams:** Be careful when modifying shell IO buffers to avoid introducing input latency or messing up Unicode byte streams.

Thank you for helping make Spritex Terminal better for everyone!
