# Contributing to MedSync 💊

Thank you for your interest in contributing to **MedSync**! MedSync is an open-source mobile health platform built with React Native (Expo) and Supabase, dedicated to making medication adherence accessible, reliable, and stress-free for seniors, caregivers, and doctors.

---

## 📜 Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Setup](#development-setup)
4. [Testing & Quality Standards](#testing--quality-standards)
5. [Pull Request Workflow](#pull-request-workflow)
6. [Security Vulnerability Disclosure](#security-vulnerability-disclosure)

---

## 🤝 Code of Conduct
By participating in this project, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful, inclusive, and collaborative.

---

## 🛠 How to Contribute
You can contribute in many ways:
- 🐛 **Bug Reports**: Open an issue describing the unexpected behavior, steps to reproduce, and environment details.
- 💡 **Feature Suggestions**: Open an issue detailing the proposal, use cases, and how it impacts patients or caregivers.
- ♿ **Accessibility Improvements**: We place the highest priority on senior accessibility (WCAG AAA contrast, screen reader compatibility, oversized touch targets).
- 📝 **Documentation**: Improve guides, clarify architecture, or add setup examples.
- 💻 **Code Contributions**: Fix bugs, add tests, or implement approved features.

---

## 💻 Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/breathtaker-adi/Medsync.git
   cd Medsync
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

4. **Start Local Bundler**
   ```bash
   npx expo start
   ```

---

## 🧪 Testing & Quality Standards

Before submitting a Pull Request, you **must** ensure all automated checks pass locally:

```bash
# 1. Run all unit & security tests
npm test

# 2. Run TypeScript strict typecheck
npx tsc --noEmit

# 3. Check Expo dependency compatibility
npx expo-doctor
```

### Commit Guidelines
We use concise, conventional commit prefixes:
- `feat:` for new capabilities
- `fix:` for bug fixes
- `docs:` for documentation updates
- `test:` for test additions or modifications
- `refactor:` for code restructurings without behavior changes
- `chore:` for dependency or build config updates

---

## 🚀 Pull Request Workflow

1. Create a dedicated branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with descriptive messages.
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against `breathtaker-adi/Medsync` (`main` branch).
5. Ensure GitHub Actions CI passes completely.

---

## 🔒 Security Vulnerability Disclosure

If you discover a security vulnerability in MedSync (especially regarding Row Level Security, PHI/PII data handling, or authentication), please **do not** open a public issue. 

Instead, report it directly to repository maintainers via GitHub Security Advisories or privately to the core team.
