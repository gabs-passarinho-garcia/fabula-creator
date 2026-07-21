#!/bin/bash
set -e

echo "=== STARTING WINDOWS CROSS-COMPILATION FOR FABULA CREATOR ==="

# 1. Ensure target is added
echo "Checking rust target..."
rustup target add x86_64-pc-windows-gnu

# 2. Build Frontend
echo "Building React + Vite frontend..."
cd frontend
bun run build
cd ..

# 3. Build Tauri Windows Executable
echo "Building Tauri Windows app..."
cd src-tauri
cargo build --target x86_64-pc-windows-gnu --release

echo "=== BUILD SUCCESSFUL ==="
echo "The compiled Windows executable is located at:"
echo "src-tauri/target/x86_64-pc-windows-gnu/release/app.exe"
