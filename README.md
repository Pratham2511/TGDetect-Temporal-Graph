# TGDetect — Temporal Graph Neural Network for APT Detection

> V16 Apex Temporal Graph Neural Network (TGNN) based Advanced Persistent Threat (APT) detection system. Real-time network traffic analysis with multi-source data fusion, concept drift adaptation, and explainable AI-driven threat intelligence.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

TGDetect is a threat detection platform that leverages **Temporal Graph Neural Networks (TGNN)** to identify Advanced Persistent Threats (APTs) in network traffic. The system fuses data from multiple sources — DARPA TC v3, UNSW-NB15, and LANL NetFlow — into a unified temporal graph representation for real-time anomaly detection.

### Key Capabilities

- **Multi-Source Data Fusion** — Ingests and correlates network logs from DARPA TC, UNSW-NB15, and LANL NetFlow into a single temporal graph
- **V16 Apex TGNN Model** — embed_dim=64, memory_dim=64, 4 attention heads, 2 layers with continuous learning via rehearsal buffers
- **Live Streaming Detection** — Real-time event ingestion with live metrics, threat counters, and activity feeds
- **Attack Backtracking** — Trace detected threats backward through the temporal graph to identify the attack chain and root cause
- **Explainable AI (XAI)** — Attention-weighted feature importance, temporal influence scoring, and decision path visualization
- **Concept Drift Adaptation** — Continuous model accuracy monitoring with automatic drift detection and rehearsal buffer rotation
- **12 Architecture Gap Widgets** — Comprehensive analytics covering log source analysis, universal encoder weights, time encoder specs, causal convolutions, domain invariance, tactic embeddings, rehearsal buffer status, drift gauges, attack chain path scores, analyst narratives, graph topology statistics, cross-source correlations, and supervised contrastive metrics
- **Smart Column Mapping** — Auto-detects and maps CSV/JSON/Syslog/NetFlow columns to TGDetect's expected schema
- **12+ Log Format Support** — CSV, JSON, Syslog, NetFlow v5/v9, Zeek JSON, Suricata EVE, Apache Access, Windows Event, AWS CloudTrail, CEF, and custom delimited formats
- **Dark/Light Theme** — Full theme switching with CSS custom properties ("Midnight Intelligence" design system)
- **Interactive Onboarding Tour** — Step-by-step guided walkthrough with SVG spotlight highlighting for first-time users

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI Library | React 19 |
| Styling | Tailwind CSS 4 + CSS Custom Properties |
| Components | shadcn/ui (Radix primitives) |
| Charts | Recharts (Area, Bar, Line, Radar, Pie, Scatter) |
| Icons | Lucide React |
| State | React Context + useRef hooks |
| Drag & Drop | @dnd-kit |

---

## Project Structure

```
tgdetect/
├── src/                          # Application source code
│   ├── app/
│   │   ├── api/route.ts          # API health-check endpoint
│   │   ├── globals.css           # CSS variables for dark/light themes
│   │   ├── layout.tsx            # Root layout with ThemeProvider
│   │   └── page.tsx              # Main SPA (Dashboard, Datasets, Profiles)
│   │
│   ├── components/
│   │   ├── tgdetect/             # TGDetect-specific components
│   │   │   ├── AnalyticsPage.tsx  #   Analytics: 5-tab layout with 12 architecture gap widgets
│   │   │   │                      #   (Source Analysis, Fused Temporal Graph, Concept Drift,
│   │   │   │                      #    Attack Backtracking, Explainability)
│   │   │   ├── ColumnMappingModal.tsx  #   Drag-and-drop column mapping for uploads
│   │   │   ├── OnboardingTour.tsx      #   Guided tour overlay with SVG mask spotlight
│   │   │   └── TimeRangePicker.tsx      #   Time range selector (1h/6h/24h/7d/30d)
│   │   └── ui/                   # shadcn/ui base components (40+)
│   │       ├── accordion.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── ... (40+ more)
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useLiveStream.ts      #   Real-time metrics & feed streaming
│   │   ├── use-mobile.ts         #   Mobile viewport detection
│   │   └── use-toast.ts          #   Toast notification hook
│   │
│   └── lib/                      # Utilities and configuration
│       ├── date-utils.ts         #   Hydration-safe date formatting
│       ├── db.ts                 #   Prisma database client
│       ├── synthetic-data.ts     #   Demo data generators for all charts (30+ exports)
│       ├── theme-context.tsx     #   Dark/light theme context (localStorage)
│       └── utils.ts              #   General utilities (cn, etc.)
│
├── public/                       # Static assets
│   ├── logo.svg                  #   TGDetect brand logo (TGNN graph icon)
│   └── robots.txt
│
├── prisma/                       # Database schema
│   └── schema.prisma
│
├── .gitignore                    # Git ignore rules
├── components.json                # shadcn/ui configuration
├── eslint.config.mjs             # ESLint configuration
├── LICENSE                       # MIT License
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS configuration
├── README.md                     # This file
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.17
- **npm** >= 9 (or **bun**)
- **git**

### Installation

```bash
# Clone the repository
git clone https://github.com/Pratham2511/TGDetect-Temporal-Graph.git
cd TGDetect-Temporal-Graph

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at **http://localhost:3000**.

### Production Build

```bash
# Create optimized production build
npm run build

# Start the production server
npm run start
```

The production server runs on **http://localhost:3000** by default.

---

## Deployment

### Vercel (Recommended)

The fastest way to deploy a Next.js application:

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Vercel auto-detects Next.js — click **Deploy**
4. Your app is live at `your-project.vercel.app`

```bash
# Or deploy via Vercel CLI
npm i -g vercel
vercel
```

### Docker

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
# Build and run
docker build -t tgdetect .
docker run -p 3000:3000 tgdetect
```

### Self-Hosted (Node.js)

```bash
# Build
npm run build

# Run with PM2 for process management
npm i -g pm2
pm2 start npm --name "tgdetect" -- start
pm2 save
pm2 startup
```

---

## Features

### Dashboard
- Real-time stat cards with trend indicators (total events, threats, graph edges, memory)
- Time-series area chart for event throughput with time range picker
- Detection results bar chart by severity
- MITRE ATT&CK tactic distribution radar chart
- Network event type pie chart
- Live activity feed with auto-updating entries
- Live streaming pulse indicators (pulsing dots, counter ticks)

### Analytics (5 Tabs + 12 Architecture Gap Widgets)

#### Tab 1 — Source Analysis
- Per-dataset metrics for DARPA TC, UNSW-NB15, LANL NetFlow
- **C1**: Log source type distribution (bar chart with log scale)
- **C2**: Universal encoder weight distribution
- **C3**: Time encoder specification callout

#### Tab 2 — Fused Temporal Graph
- Graph topology statistics, edge distribution, temporal patterns
- **C4**: Causal convolution architecture callout
- **C5**: Domain invariance analysis
- **D1**: Graph statistics summary (nodes, edges, density, avg degree)

#### Tab 3 — Concept Drift
- Model accuracy tracking, drift detection thresholds, rehearsal buffer status
- **C6**: Tactic embedding cluster scatter plot
- **C7**: Rehearsal buffer composition (stacked bar)
- **C8**: Drift distance gauge with threshold indicators

#### Tab 4 — Attack Backtracking
- Temporal path tracing from detection to root cause through the graph
- **C9**: Attack chain path scores
- **C10**: Analyst narrative backtracking timeline

#### Tab 5 — Explainability
- Feature attribution, attention weights, temporal influence scores
- **D2**: Cross-source correlation table
- **E1**: Supervised contrastive learning metrics

### Datasets
- 12+ log format support with format detection
- Smart column mapping UI (drag-and-drop)
- Import preview with data quality indicators
- Dataset versioning and metadata management

### Profiles
- Create analysis profiles per dataset/investigation
- Configurable V16 Apex parameters (temporal window, memory dim, attention heads, layers, thresholds)
- Profile comparison and cloning

---

## Design System — "Midnight Intelligence"

TGDetect uses a CSS custom properties design system with HSL tokens for seamless dark/light theme switching:

- **Dark theme**: Deep navy backgrounds (`hsl(222, 47%, 11%)`) with blue accents
- **Light theme**: Clean slate surfaces (`hsl(0, 0%, 98%)`) with crisp contrast
- **Component classes**: `.sidebar-shell`, `.header-shell`, `.tg-card`, `.badge-*`, `.section-title`
- **Chart constants**: `CHART_TOOLTIP_STYLE`, `CHART_GRID_STYLE`, `CHART_AXIS_STYLE`, `CHART_COLORS`

---

## MITRE ATT&CK Mapping

The detection engine maps findings to the following tactics:

| Tactic | Examples |
|--------|---------|
| Initial Access | Phishing, Exploit Public-Facing App |
| Execution | Command & Scripting Interpreter, User Execution |
| Persistence | Account Manipulation, Bootkit |
| Privilege Escalation | Exploitation for Privilege Escalation |
| Defense Evasion | Indicator Blocking, Process Injection |
| Credential Access | LSASS Memory, Credential Dumping |
| Discovery | Network Service Discovery, Remote System Discovery |
| Lateral Movement | Remote Services, Pass the Hash |
| Collection | Archive Collected Data, Data from Local System |
| Exfiltration | Exfiltration Over C2 Channel, DNS Tunneling |
| Command & Control | Standard Application C2 Protocol, Web Service |

---

## Model Architecture (V16 Apex)

```
Input: Network event stream → Node features (IP, port, protocol, bytes, packets, duration)
                                 ↓
                    Temporal Graph Construction
                                 ↓
            ┌────────────────────────────────────┐
            │  TGNN Layer 1 (embed_dim=64)       │
            │  ├── Multi-Head Attention (4 heads) │
            │  ├── Temporal Memory (memory_dim=64)│
            │  └── Message Passing (GAT conv)    │
            ├────────────────────────────────────┤
            │  TGNN Layer 2 (embed_dim=64)       │
            │  ├── Multi-Head Attention (4 heads) │
            │  ├── Temporal Memory (memory_dim=64)│
            │  └── Message Passing (GAT conv)    │
            └────────────────────────────────────┘
                                 ↓
                   Detection Head (MLP + Sigmoid)
                                 ↓
              Output: Threat probability per node/edge
```

---

## Environment Variables

This is a frontend-only demo. No environment variables are required for the basic deployment.

```env
# Port (default: 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **DARPA Engagement** — DARPA TC v3 dataset for realistic APT scenario evaluation
- **UNSW-NB15** — Network behavior dataset for intrusion detection benchmarking
- **LANL NetFlow** — High-volume network flow data for scalable detection testing
- **MITRE ATT&CK** — Adversarial tactics, techniques, and common knowledge base
