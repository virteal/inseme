# 🗳️ Inseme Monorepo - Citizen Ecosystem & Liquid Democracy

Welcome to the **Inseme** repository, an **open-source** and **neutral** digital infrastructure
dedicated to citizen participation, augmented deliberation, and democratic transparency.

This project brings together the tools of the **#PERTITELLU** citizen movement (Corte, Corsica) and
aims to provide free solutions to empower citizens.

_Inseme operates the **civic layer (Layer 4)** of the FractaVolta four-layer stack (energy / compute
/ cognition / civic), as the **platform layer** of a multi-repository public corpus. Inseme keeps its own
identity — neutral, MIT-licensed, governed by its citizen community. The corpus framing simply
names where it interoperates with the rest of the corpus. The common methodology — *Discours de la
seconde méthode* — lives in
[barons-Mariani/research/second_method.md](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/second_method.md).
See [fractavolta.com](https://fractavolta.com) for the integrated picture._

| Repository                                                           | Role                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [MareNostrum](https://github.com/JeanHuguesRobert/marenostrum)       | Strategic framework. CXU specification, DHITL axiom, Mediterranean solar commons.                                                                                                                                              |
| [FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta)       | Engineering firm + software publisher + stack operator. EPN, DC-native nodes, PGN, IPN, Mariani Village.                                                                                                                       |
| [Cogentia](https://github.com/JeanHuguesRobert/cogentia)             | Cognitive infrastructure tooling. `cogentia.js` CLI, Cogentia Commons methodology, continuation protocol.                                                                                                                      |
| **inseme**                                                           | **Platform — COP runtime, briques, Kudocracy.Survey, Inseme Agora, Ophélia AI mediator, Atlas of Biodiversity. MIT-licensed, governed by citizens.**                                                                           |
| [barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani) | Political and institutional framework. Plan 2038, _Discours de la seconde méthode_.                                                                                                                                            |
| [Inox](https://github.com/JeanHuguesRobert/Inox)                     | Language and runtime substrate. Concatenative stack VM, strict control/data plane separation. Intended runtime for the agents and nodes of the future _Fractanet_. JS today, WASM and C/C++ next, ESP32 bare-metal eventually. |
| [Ubikia](https://github.com/JeanHuguesRobert/ubikia)                 | Editorial derivation and publication layer. Source-first derived products, personas, platform packages, and publication ledger.                                                                                                  |

---

## 🏗️ Modular Architecture

Inseme is designed as a modular ecosystem of "Bricks" orchestrated by a central protocol. This
ensures flexibility, sovereignty, and collective intelligence.

> **[Read the Detailed Modular System Documentation](docs/MODULAR_SYSTEM.md)**

---

## 🏛️ Repository Structure

The project is organized as a monorepo (Turbo) to facilitate code sharing between the different
components of the ecosystem:

### 📱 Applications (`/apps`)

- **`apps/platform` (Kudocracy.Survey)**: The consultation and engagement platform.
  - **Focus**: Consultations, Collaborative Wiki, Citizen Gazette, Social Café.
  - **Architecture**: Multi-instance (Corte, Bastia, Università di Corsica, etc.).
- **`apps/inseme` (The Agora)**: Direct and liquid democracy tool.
  - **Focus**: Physical/remote assemblies, instant voting, digital gestures.
  - **AI**: Ophélia (AI Mediator) integrated via Edge Functions.
- **`apps/cyrnea` (Cyrnea)**: Social and gamified experience for community spaces (Bars, Cafés).
  - **Focus**: Bar animation, local AI assistant (Ophélia), Citizen Gazette, PWA for clients.
  - **Tech**: React + Vite + Netlify Edge Functions (AI).

### 📦 Key Packages (`/packages`)

The ecosystem is composed of several specialized packages:

- **`packages/cop-*`**: Cognitive Orchestration Protocol (Kernel, CLI, Host). The
  [Reactive Cognitive Extension](packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md) (v0.1,
  operational note) defines the protocol surface for packet attractors, CogQueries, and pressure
  strategies; native implementation is delegated to
  [Inox](https://github.com/JeanHuguesRobert/Inox).
  [COP Implementation Profiles](packages/cop-core/ImplementationProfiles.md) (working-note) defines
  the documentation convention concrete COP implementations should follow; the kernel reference
  profile lives in [`packages/cop-kernel/PROFILE.md`](packages/cop-kernel/PROFILE.md). Developer
  convergence with [Cogentia](https://github.com/JeanHuguesRobert/cogentia) happens in
  [`sandbox/cop-continuation-bac-a-sable/`](sandbox/cop-continuation-bac-a-sable/) — a CLI + ~20
  scenarios (notaire, mairie, greffier, federation, …) injecting real `cop-kernel` primitives.
- **`packages/brique-*`**: Functional modules (Wiki, Blog, Tasks, Group, **Map**, **Auxilia** —
  digital hospitality for mobile data and battery, etc.).
- **`packages/models`**: Sovereign LLM controller for local inference.
- **`packages/kudocracy`**: Core governance models and liquid democracy logic.
- **`packages/ui`**: Shared design system and component library.

#### 🗺️ Brique-Map Module

The `packages/brique-map` package provides the complete GIS infrastructure:

- **CitizenMap**: Interactive mapping component with IGN integration
- **BiodiversityLayer**: Specialized layer for biodiversity observations
- **BiodiversityFilters**: Real-time filtering UI components
- **Location Services**: Geocoding, address search, and coordinate parsing

---

## 🎯 Key Features

### 1. 💬 Ophélia — The AI Mediator

Ophélia is the platform's AI. She answers questions, helps formulate ideas, guides users through
processes, and facilitates consensus during debates without ever imposing herself.

### 2. 🗳️ Liquid Democracy (Kudocracy)

Allows users to submit proposals, vote, and delegate their voice to a trusted person on a specific
topic. The Agora (`apps/inseme`) pushes this concept further with real-time digital gestures.

### 3. 🌿 Atlas of Biodiversity

A comprehensive Geographic Information System (GIS) for biodiversity observation and citizen
science. Features interactive mapping, real-time filtering, GBIF data integration, and citizen
contribution tools.

- **Interactive Maps**: Leaflet-based with IGN layers and custom biodiversity markers
- **Citizen Contributions**: Submit and validate wildlife observations
- **Data Integration**: GBIF/INPN import with spatial-temporal filtering
- **Real-time Filtering**: By species, date, location, and validation status
- **Open Data**: GeoJSON API for external integrations

> **[📋 Full Documentation](docs/biodiversite-guide-demarrage.md)** |
> **[🧪 Testing Guide](docs/biodiversite-tests-validation.md)**

### 4. 🛡️ Digital Sovereignty

Built-in support for local LLMs via `@kudocracy/models`, ensuring that sensitive data and democratic
deliberations stay within your infrastructure.

---

## 🚀 Technology (Modern Stack)

- **Frontend**: React (v18/v19) + Vite + Tailwind CSS.
- **Backend Realtime**: Supabase (PostgreSQL, Realtime, Auth).
- **GIS & Mapping**: Leaflet + React-Leaflet + PostGIS + IGN Geoportal.
- **AI Orchestration**: Multi-provider support (OpenAI, Local LLMs via GGUF).
- **Multi-Instance**: Dynamic subdomain-based resolution for per-commune deployment.
  [See Multi-Instance Doc](packages/cop-host/docs/MULTI_INSTANCE.md).

---

## 🛠️ Installation & Development

### Prerequisites

- Node.js (v20+ recommended)
- Netlify CLI (`npm install netlify-cli -g`)

### Quick Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/JeanHuguesRobert/inseme.git
   cd inseme
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Launch an application**:

   ```bash
   # For the Citizen Platform (Survey)
   pnpm run platform:dev

   # For the Inseme Agora
   pnpm run inseme:dev
   ```

4. **Setup the Biodiversity Atlas** (optional):

   ```bash
   # Apply database migrations
   supabase db push

   # Import sample data from GBIF
   node scripts/import_gbif.js

   # Test the API
   curl "http://localhost:8888/api/biodiversity/observations"
   ```

   > **[📋 Complete Setup Guide](docs/biodiversite-guide-demarrage.md)**

---

## ⚖️ Neutrality, Ethics & Legal Framework

Inseme is a **neutral** and **independent** infrastructure. It does not finance, promote, or support
any political party, electoral campaign, candidate, or list. It provides digital tools usable by any
citizen, collective, or institution wishing to strengthen local democracy.

The ethical principles, governance of Ophélia, and legal constraints (data protection, democratic
processes, usage in social spaces like bars) are tracked in the technical roadmap:

- See [ROADMAP-TECH.md](./ROADMAP-TECH.md), section **“Éthique & Gouvernance d’Ophélia (P2)”** and
  **“Gouvernance applicative via Kudocracy (P3)”**.

---

## 📜 License & Author

This project is licensed under the **MIT License**.

**Author: Jean Hugues Noël Robert**

- Project supported by the **C.O.R.S.I.C.A.** association.
- [LePP.fr](https://lepp.fr) community.
- Made with ❤️ in Corte, Corsica.

---

### #PERTITELLU | CORTI CAPITALE
