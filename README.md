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
- **Smart Column Mapping** — Auto-detects and maps CSV/JSON/Syslog/NetFlow columns to TGDetect's expected schema
- **12+ Log Format Support** — CSV, JSON, Syslog, NetFlow v5/v9, Zeek JSON, Suricata EVE, Apache Access, Windows Event, AWS CloudTrail, CEF, and custom delimited formats
- **Dark/Light Theme** — Full theme switching with CSS custom properties for all components
- **Interactive Onboarding Tour** — Step-by-step guided walkthrough for first-time users

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
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main SPA with Dashboard, Datasets, Profiles
│   │   ├── layout.tsx            # Root layout with ThemeProvider
│   │   └── globals.css           # CSS variables for dark/light themes
│   ├── components/
│   │   ├── tgdetect/
│   │   │   ├── AnalyticsPage.tsx  # Deep analytics: source analysis, graph fusion,
│   │   │   │                      # concept drift, backtracking, explainability
│   │   │   ├── OnboardingTour.tsx # Guided tour overlay with spotlight highlighting
│   │   │   ├── ColumnMapper.tsx   # Drag-and-drop column mapping for uploads
│   │   │   └── TimeRangePicker.tsx # Time range selector (1h/6h/24h/7d/30d)
│   │   └── ui/                   # shadcn/ui components
│   ├── hooks/
│   │   └── useLiveStream.ts      # Real-time metrics & feed item streaming
│   └── lib/
│       ├── theme-context.tsx     # Dark/light theme context with localStorage
│       ├── date-utils.ts         # Hydration-safe date formatting
│       └── synthetic-data.ts    # Demo data generators for charts & feeds
├── public/
└── package.json
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
git clone https://github.com/Pratham2511/-TGDetect-Temporal-Graph.git
cd -TGDetect-Temporal-Graph

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
- Time-series area chart for event throughput
- Detection results bar chart by severity
- MITRE ATT&CK tactic distribution radar chart
- Network event type pie chart
- Live activity feed with auto-updating entries
- Live streaming pulse indicators (pulsing dots, counter ticks)

### Analytics
- **Source Analysis** — Per-dataset metrics for DARPA TC, UNSW-NB15, LANL NetFlow
- **Fused Temporal Graph** — Graph topology stats, edge distribution, temporal patterns
- **Concept Drift** — Model accuracy tracking, drift detection thresholds, rehearsal buffer status
- **Attack Backtracking** — Temporal path tracing from detection to root cause through the graph
- **Explainability** — Feature attribution, attention weights, temporal influence scores

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

This is a frontend-only demo. No environment variables are required for the basic deployment. The following optional variables can be configured:

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
