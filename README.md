<div align="center">

```
 ⚔️ ───────────────────────────────────────────────────────── ⚔️
   ___  _   ___  _  _ _    _      ___ ___ ___   _  _____ ___  ___ 
  | __|/_\ | _ \| || | |  /_\    / __| _ \ __| /_\ |_   _/ _ \| _ \
  | _/ _ \| _ <| __ | |__/ _ \  | (__|   / _| / _ \  | || (_) |   /
  |_/_/ \_\___/|_||_|____/_/ \_\  \___|_|_\___/_/ \_\ |_| \___/|_|_\
 ⚔️ ───────────────────────────────────────────────────────── ⚔️
```

### 🔮 *O Grimório Digital definitivo para os Heróis de Fábula Ultima*

[![Tauri v2](https://img.shields.io/badge/Tauri-v2.11-FFC107?style=for-the-badge&logo=tauri&logoColor=black)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-v1.3-fbf0df?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)
[![Rust](https://img.shields.io/badge/Rust-v1.77+-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/Licença-GPL--3.0-green?style=for-the-badge)](./LICENSE)

[✨ Recursos](#-recursos--habilidades) •
[🖼️ Galeria](#-galeria-de-telas) •
[🏰 Instalação & Forja](#-manual-da-forja-desenvolvimento) •
[🔮 Arquitetura](#-arquitetura--alquimia) •
[🛡️ Créditos](#-créditos--licença)

---

</div>

## 🧙‍♂️ Sobre o Projeto

O **Fabula Creator** é uma aplicação desktop de alta performance criada para jogadores e mestres do RPG **Fábula Ultima (TTRPG)**. Inspirado nos clássicos **JRPGs da era 16-bits**, o aplicativo combina uma interface pixelated nostálgica com a agilidade de um motor moderno (Tauri + React + SQLite).

Crie heróis lendários, acompanhe seus atributos de dados ($d6$ a $d12$), gerencie inventários, feitiços, ligações e proezas com a precisão de um algoritmo refinado.

---

## ⚔️ Recursos & Habilidades

```
 ┌───────────────────────────────────────────────────────────┐
 │ 🛡️ CRIAÇÃO DE HERÓIS                                      │
 │   • Passo a passo intuitivo para geração de atributos     │
 │   • Seleção de Classes, Perícias, Identidade e Origem     │
 ├───────────────────────────────────────────────────────────┤
 │ 🏰 GALERIA DE PERSONAGENS                                 │
 │   • Armazém local e seguro via banco SQLite nativo        │
 │   • Gestão de múltiplos aventureiros e campanhas          │
 ├───────────────────────────────────────────────────────────┤
 │ 🗡️ FICHA COMPLETA INTERATIVA                              │
 │   • Cálculo automático de HP, MP, IP e Atributos          │
 │   • Gestão de Equipamentos, Magias e Ligações (Bonds)     │
 ├───────────────────────────────────────────────────────────┤
 │ 🌐 MULTILINGUE & ÁUDIO RETRÔ                             │
 │   • Suporte completo a Português (PT-BR) e Inglês (EN-US)  │
 │   • Trilha/Efeitos sonoros e celebração com confetis 8-bit│
 └───────────────────────────────────────────────────────────┘
```

---

## 🖼️ Galeria de Telas

| 🏰 Galeria de Heróis | 📜 Ficha de Personagem |
| :---: | :---: |
| ![Hero Gallery](./docs/screenshots/gallery.png) | ![Character Sheet](./docs/screenshots/sheet.png) |

| 🛡️ Criador Passo a Passo | 🗡️ Equipamentos & Feitiços |
| :---: | :---: |
| ![Creation Wizard](./docs/screenshots/creator.png) | ![Inventory](./docs/screenshots/inventory.png) |

> *(Substitua as imagens em `./docs/screenshots/` conforme o avanço do projeto)*

---

## 🏰 Manual da Forja (Desenvolvimento)

Para preparar o seu ambiente e forjar o projeto em sua máquina local, você precisará dos seguintes artefatos:

### ⚙️ Pré-requisitos

1. **[Bun](https://bun.sh/)** (Runtime JavaScript e Gerenciador de Pacotes)
2. **[Rust](https://www.rust-lang.org/)** (com `cargo` e `rustup`)
3. Dependências do **Tauri v2** para seu sistema operacional (Webkit/GTK no Linux ou Build Tools no Windows).

---

### 🕹️ Rodando em Modo de Treino (Dev)

Clone o repositório e execute a guilda no modo de desenvolvimento:

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/fabula-creator.git
cd fabula-creator

# 2. Instale as dependências do Frontend
cd frontend
bun install
cd ..

# 3. Inicie o servidor de desenvolvimento do Tauri
bun dev
```

---

### ⚒️ Forjando os Executáveis (Build & Cross-Compilation)

O projeto suporta geração de executáveis para Linux e Windows.

#### 🐧 Build para Linux:
```bash
bun build:linux
```

#### 🪟 Build para Windows (Cross-compilation via Linux):
Requer a target `x86_64-pc-windows-gnu` do Rust instalada.

```bash
# Executa o script de cross-compilação para Windows
bun build:windows
```

*Os instaladores e arquivos binários gerados serão depositados no diretório `src-tauri/target/release/bundle/`.*

---

## 🔮 Arquitetura & Alquimia

O **Fabula Creator** utiliza a arquitetura híbrida de ultra-baixo consumo de memória do Tauri v2:

```
┌──────────────────────────────────────────────────────────┐
│                     INTERFACE (VIEW)                     │
│         React 19 + TypeScript + Tailwind CSS v4          │
│                  (Vite Server em Dev)                    │
└────────────────────────────┬─────────────────────────────┘
                             │  IPC (Inter-Process Comm.)
┌────────────────────────────▼─────────────────────────────┐
│                    NÚCLEO (BACKEND)                      │
│                Tauri v2 (Engine em Rust)                 │
│        Banco de Dados Local: SQLite (`rusqlite`)         │
└──────────────────────────────────────────────────────────┘
```

---

## 🧪 Testes & Qualidade

Mantenha a qualidade da espada afiada antes de ir para o combate:

```bash
# Executa os testes no frontend e backend (Rust)
bun test
```

---

## 🛡️ Créditos & Licença

* **Sistema de RPG:** Baseado em **Fábula Ultima TTRPG**, criado por Need Games / Emanuele Galletto.
* **Desenvolvimento:** Criado com dedicação por Gabriel 'Gabs' Garcia.
* **Licença:** Distribuído sob a licença **GNU General Public License v3.0 (GPL-3.0)**. Veja o arquivo [`LICENSE`](./LICENSE) para mais detalhes.

---

<div align="center">

> *"Porque dele, e por meio dele, e para ele são todas as coisas. A ele, pois, a glória eternamente. Amém!"*  
> — **Romanos 11:36** (Soli Deo Gloria ✝️)

</div>