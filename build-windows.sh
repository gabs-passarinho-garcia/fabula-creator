#!/bin/bash
set -e

echo "=== STARTING WINDOWS CROSS-COMPILATION FOR FABULA CREATOR ==="

# 1. Garantir que o target do Rust existe
echo "Verificando target do Rust..."
rustup target add x86_64-pc-windows-gnu

# 2. Usar o Tauri CLI via Bun para orquestrar o frontend e o backend
echo "Empacotando a aplicação Tauri para Windows..."
bun tauri build --target x86_64-pc-windows-gnu

echo "=== BUILD SUCCESSFUL ==="
echo "O executável e o instalador estarão localizados em:"
echo "src-tauri/target/x86_64-pc-windows-gnu/release/bundle/"