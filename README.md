# ObsiForge // Cyber-Industrial Minecraft Engine Core

![ObsiForge Version](https://img.shields.io/badge/version-1.0.1b--beta-00e5ff?style=for-the-badge&logo=electron)
![Build](https://img.shields.io/badge/build-passing-33ff00?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-ffb000?style=for-the-badge)

> **ObsiForge** is an advanced cyber-industrial Minecraft Server Management & Cloud Deployment platform built with React, TypeScript, Electron, Neon Serverless PostgreSQL, and Oracle Cloud Infrastructure (OCI).

---

## ⚡ Key Features

- **24/7 Cloud Persistence**: Deploy decoupled Minecraft server engines to Oracle Cloud Infrastructure (Ampere A1 ARM / AMD Micro) that remain running even when your local PC or application is shut down.
- **Dynamic Multiplayer Tunnel Routing**: Automatic generation of clean joining hostnames (`{SERVER_NAME}.{RANDOM_CODE}.obsiforge.ply.gg`) with 1-click clipboard copying.
- **Neon Serverless PostgreSQL Sync**: Encrypted cloud synchronization for server instances, worlds, and role-based access control.
- **Live Minecraft Engine Manifests**: Direct real-time version stream querying from Mojang, PaperMC, Purpur, and Fabric APIs.
- **Automated Update Engine**: Seamless GitHub Releases integration querying `meowster404/obsiforge` with in-app notifications and one-click `.exe` installer upgrades.
- **Built-in System Monitor**: Real-time terminal stats, CPU telemetry, memory utilization graphs, and interactive crash logs.

---

## 📦 Current Version

- **Current Build**: `1.0.1b` (Public Beta)
- **Next Release**: `1.0.0` (Official Production Launch)

---

## 🚀 Quick Start (Development)

### 1. Clone the Repository
```bash
git clone https://github.com/meowster404/obsiforge.git
cd obsiforge
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Neon PostgreSQL database URL and settings.

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Locally
```bash
# Run web client + Electron desktop runtime simultaneously:
npm run dev

# Or run Vite browser interface only:
npm run dev:vite
```

---

## 🔨 Compiling Windows Installer (.EXE)

To compile the standalone Windows NSIS installer `.exe`:
```bash
npm run dist:win
```
The output `.exe` installer will be located in the `release/` directory.

---

## 🔄 Automated CI/CD (GitHub Actions)

When a version tag is pushed (e.g. `v1.0.1b`), GitHub Actions will automatically:
1. Compile the production bundles.
2. Package the Windows `.exe` installer using `electron-builder`.
3. Create a GitHub Release under `meowster404/obsiforge` tagged as Pre-release for beta builds.

---

## 🛡️ License
Distributed under the MIT License. Developed for high-performance Minecraft communities.
