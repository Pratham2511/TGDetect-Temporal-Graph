# CTU-13 Dataset — What Logs It Contains and Their Types

This documents the dataset TG-Detect was trained and evaluated on for the
`ctu13_ho_c47` run, what kind of logs it holds, and the exact field types.

## What CTU-13 is

**CTU-13** is a botnet-traffic dataset captured at **CTU University, Czech Republic,
in 2011** (Garcia et al., *"An empirical comparison of botnet detection methods,"*
Computers & Security, 2014). It consists of **13 captures** ("scenarios"), each a real
network trace in which one or more machines were **deliberately infected with a
specific botnet malware family** and run alongside normal user traffic and
uncontrolled background traffic.

**The "logs" are NOT raw packets or host/OS event logs.** The files we used are
**Argus bidirectional NetFlow** records — one row per network *flow* (a
source↔destination conversation aggregated over a short interval), stored as
labeled `*.binetflow` files (xz-compressed as `*.binetflow.xz` on the Modal volume).
This is **network-telemetry**, contrasted with the base paper's **host/EDR telemetry**
(process/file/registry events from Wazuh agents).

## The flow log format — 15 fields per record

Header row (comma-separated):

```
StartTime,Dur,Proto,SrcAddr,Sport,Dir,DstAddr,Dport,State,sTos,dTos,TotPkts,TotBytes,SrcBytes,Label
```

| # | Field | Type | Meaning / notes |
|---|---|---|---|
| 1 | `StartTime` | timestamp | Flow start, format `YYYY/MM/DD HH:MM:SS.ffffff` (slash date, **not** ISO-8601 → parsed with `strptime`, emitted as epoch seconds) |
| 2 | `Dur` | float (s) | Flow duration |
| 3 | `Proto` | categorical str | `tcp`, `udp`, `icmp`, `arp`, `rtp`, … |
| 4 | `SrcAddr` | IPv4 str | Source IP → becomes a graph node `ip:<addr>` |
| 5 | `Sport` | int / hex str | Source port; ~12% appear as hex `0x....` (parsed `int(x, 0)`); ~7% empty |
| 6 | `Dir` | categorical str | Direction token, space-padded (e.g. `'   ->'`, `'<->'`) → stripped |
| 7 | `DstAddr` | IPv4 str | Destination IP → graph node `ip:<addr>` |
| 8 | `Dport` | int / hex str | Destination port (same hex/empty quirks as `Sport`) |
| 9 | `State` | categorical str | Protocol/connection state (e.g. `CON`, `S_RA`, `URP`, `FSPA_FSPA`) |
| 10 | `sTos` | int | Source type-of-service byte; sometimes empty → default 0 |
| 11 | `dTos` | int | Destination type-of-service byte; empty → 0 |
| 12 | `TotPkts` | int | Total packets in the flow |
| 13 | `TotBytes` | int | Total bytes in the flow |
| 14 | `SrcBytes` | int | Bytes sent by the source (`DstBytes = TotBytes − SrcBytes ≥ 0`) |
| 15 | `Label` | str | Ground-truth annotation string (see below) |

## Label semantics

The `Label` string is free-text with a `From-`/`To-` flow-direction prefix. There are
**dozens of distinct label strings** (58 distinct values in scenario c52 alone), so we
match a **substring**, never an enum:

- **malicious (1)** ⇔ `"botnet"` appears in `Label.lower()` (e.g.
  `flow=From-Botnet-V52-1-TCP-...`).
- **benign (0)** ⇔ everything else, i.e. `Normal` (labeled legitimate hosts) and
  `Background` (unverified/uncontrolled traffic).

Two background policies are supported (this run used the first):
- **`benign` (used here):** keep `Background` + `Normal` as label 0 → realistic, heavy
  class imbalance (~0.9% positive on the test scenario).
- **`drop`:** discard `Background`, keep only `Normal` vs `Botnet` → cleaner but
  less realistic. Deferred as a follow-up variant.

## The 13 scenarios — family map and per-scenario counts

Re-derived directly from the built graphs on Modal (**0 timestamp parse rejects across
18.7M flows**), correcting an earlier research table that was wrong:

| Scenario (dir) | Botnet family | Flows | Malicious | Mal% |
|---|---|---|---|---|
| c42 | Neris | 2,824,636 | 40,961 | 1.45% |
| c43 | Neris | 1,808,122 | 20,941 | 1.16% |
| c44 | Rbot | 4,710,638 | 26,822 | 0.57% (largest) |
| c45 | Rbot | 1,121,076 | 2,580 | 0.23% |
| c46 | fast-flux/Virut | 129,832 | 901 | 0.69% |
| c47 | **donbot** | 558,919 | 4,630 | 0.83% |
| c48 | Sogou | 114,077 | 63 | 0.06% |
| c49 | qvod/Murlo | 2,954,230 | 6,127 | 0.21% |
| c50 | Neris | 2,087,508 | 184,987 | 8.86% (most pos.) |
| c52 | Rbot | 107,251 | 8,164 | 7.61% (smallest) |
| c53 | NSIS.ay | 325,471 | 2,168 | 0.67% |
| c54 | fast-flux/Virut | 1,925,149 | 40,003 | 2.08% |
| c51 | Rbot | — | — | **no `*.binetflow.xz` in the volume; excluded** |

**Family groups:** Neris {42,43,50}; Rbot {44,45,52}; fast-flux/Virut {46,54};
donbot {47}; Sogou {48}; qvod/Murlo {49}; NSIS.ay {53}.

## What the `ctu13_ho_c47` run actually used (family-disjoint split)

- **TRAIN (4 families):** c52 Rbot · c46 fast-flux/Virut · c53 NSIS.ay · c48 Sogou
- **TEST (unseen family):** c47 **donbot** — this family appears in **no** training
  scenario, which is what makes the result a genuine unseen-family generalization test.

## How these logs become the temporal graph the model sees

Each flow record is turned into a directed **edge** in a temporal graph:

- **Nodes = IP addresses.** `SrcAddr`/`DstAddr` → nodes typed `ip:<addr>`. The test
  scenario c47 has **107,341 unique IP nodes**. Node features are intentionally
  **1-dimensional (type-only, all-ones)** — every node is an IP, so there is no
  informative per-node feature, and using degree/malicious-ratio would **leak** the
  label. All discriminative signal therefore lives on the **edges**.
- **Edges = flows.** `NETWORK_FLOW` relation, one edge per flow (c47: **558,919
  edges**). Each edge carries a **37-dimensional feature vector**, all derived
  **per-row (leakage-free)** from the fields above:
  - numeric (log1p): duration, TotBytes, SrcBytes, DstBytes, TotPkts, plus rates
    (bytes/pkt, bytes/sec, pkts/sec, src-byte ratio);
  - one-hots: `Proto`, `Dir`, `State` (fixed small vocabularies + "other");
  - **port service buckets** (well-known / ephemeral / DNS / HTTP / HTTPS / IRC /
    SMTP / other) — **never raw port integers**, which would just memorize a
    scenario's C2 port and fail to transfer;
  - one relative-time feature.
- **Temporal snapshots.** Flows are grouped into **60-second sliding windows with a
  30-second stride** *within a single scenario* (scenarios are never merged onto one
  2011 timeline — their clocks overlap). The GNN encodes each snapshot with SAGEConv
  and a GRU carries state across snapshots; the edge head scores each flow.
  - Note: sliding windows overlap, so the ~4,630 malicious c47 flows are seen roughly
    twice → the evaluated test set is **1,068,851 flow-instances / 9,256 positives**.

## One-line summary

CTU-13 gives us **labeled bidirectional NetFlow logs** (15 typed fields per flow,
`Botnet`/`Normal`/`Background` ground truth) from 13 real 2011 captures spanning 7
botnet families. TG-Detect consumes them as a **temporal IP-flow graph** — IP nodes,
per-flow edges with 37-dim leakage-free flow features — and is scored on a **family it
never saw in training** (donbot). This is **network telemetry**, distinct from the base
paper's **host/EDR telemetry**, which is why the two results are not directly
comparable.
