// TGDetect Synthetic Data Generator
// Generates realistic-looking demo data for the panel presentation
// Reflects V16_Apex architecture: DARPA/UNSW/LANL datasets, MITRE ATT&CK tactics

export interface NetworkEvent {
  timestamp: string;
  sourceIP: string;
  destIP: string;
  sourcePort: number;
  destPort: number;
  protocol: string;
  eventType: 'normal' | 'suspicious' | 'malicious';
  threatScore: number;
  bytesTransferred: number;
  dataset: 'DARPA' | 'UNSW' | 'LANL';
  frequency: number;
  temporal_burst: number;
  rarity: number;
}

export interface DetectionResult {
  id: string;
  timestamp: string;
  attackType: string;
  tactic: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  sourceNode: string;
  targetNode: string;
  confidence: number;
  graphScore: number;
  causalDelta: number;
  status: 'Detected' | 'Investigating' | 'Contained';
  dataset: string;
}

export interface TimeSeriesPoint {
  time: string;
  normal: number;
  suspicious: number;
  malicious: number;
  graphScore: number;
}

export interface ModelMetric {
  name: string;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  aucPr: number;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  temporalWindows: number;
  avgClusteringCoeff: number;
  graphDensity: number;
  connectedComponents: number;
  embedDim: number;
  memoryDim: number;
  numHeads: number;
  nLayers: number;
}

export interface UserProfile {
  id: string;
  name: string;
  description: string;
  dataset: string;
  status: 'active' | 'inactive';
  created: string;
  lastModified: string;
  config: {
    temporalWindow: number;
    memoryDim: number;
    numHeads: number;
    nLayers: number;
    embedDim: number;
    threshold: number;
  };
}

export interface UploadedDataset {
  id: string;
  name: string;
  format: string;
  size: string;
  events: number;
  uploadedAt: string;
  status: 'processed' | 'pending' | 'error';
  source: string;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

const internalIPs = [
  '192.168.1.10', '192.168.1.22', '192.168.1.35', '192.168.1.48',
  '192.168.1.55', '192.168.1.67', '192.168.1.78', '192.168.1.89',
  '192.168.2.15', '192.168.2.30', '10.0.0.5', '10.0.0.12',
  '10.0.0.25', '10.0.1.8', '10.0.1.33', '172.16.0.10',
];

const externalIPs = [
  '45.33.32.156', '104.236.198.48', '162.247.74.201', '198.51.100.23',
  '203.0.113.45', '185.220.101.34', '91.219.237.249', '23.129.64.100',
];

const protocols = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS', 'DNS', 'SSH'];
const datasets: NetworkEvent['dataset'][] = ['DARPA', 'UNSW', 'LANL'];

const mitreTactics = [
  'Reconnaissance', 'Initial Access', 'Execution', 'Persistence',
  'Privilege Escalation', 'Defense Evasion', 'Credential Access',
  'Discovery', 'Lateral Movement', 'Collection', 'Command & Control',
  'Exfiltration', 'Impact',
];

const attackTypes: Record<string, string> = {
  'Reconnaissance': 'Port Scanning',
  'Initial Access': 'Phishing Payload',
  'Execution': 'PowerShell Dropper',
  'Persistence': 'Registry Run Key',
  'Privilege Escalation': 'Token Manipulation',
  'Defense Evasion': 'Log Cleaning',
  'Credential Access': 'Mimikatz Dump',
  'Discovery': 'Network Scan',
  'Lateral Movement': 'Pass-the-Hash',
  'Collection': 'Data Staging',
  'Command & Control': 'DNS Tunneling',
  'Exfiltration': 'Covert Channel',
  'Impact': 'Ransomware Payload',
};

function randomIP(pool: string[]): string {
  return pool[Math.floor(rand() * pool.length)];
}

export function generateNetworkEvents(count: number = 200): NetworkEvent[] {
  const events: NetworkEvent[] = [];
  const now = new Date('2024-06-15T08:00:00');

  for (let i = 0; i < count; i++) {
    const isInternal = rand() > 0.3;
    const isMalicious = rand() > 0.75;
    const isSuspicious = !isMalicious && rand() > 0.6;

    let eventType: NetworkEvent['eventType'] = 'normal';
    let threatScore = Math.floor(rand() * 20);
    if (isMalicious) {
      eventType = 'malicious';
      threatScore = Math.floor(rand() * 40) + 60;
    } else if (isSuspicious) {
      eventType = 'suspicious';
      threatScore = Math.floor(rand() * 35) + 25;
    }

    const ts = new Date(now.getTime() + i * (rand() * 30000 + 5000));

    events.push({
      timestamp: ts.toISOString(),
      sourceIP: isInternal ? randomIP(internalIPs) : randomIP(externalIPs),
      destIP: isInternal ? randomIP(internalIPs) : randomIP(externalIPs),
      sourcePort: Math.floor(rand() * 60000) + 1024,
      destPort: [22, 80, 443, 3389, 8080, 53, 445, 25, 110, 143][Math.floor(rand() * 10)],
      protocol: protocols[Math.floor(rand() * protocols.length)],
      eventType,
      threatScore,
      bytesTransferred: Math.floor(rand() * 100000) + 100,
      dataset: datasets[Math.floor(rand() * datasets.length)],
      frequency: Math.round(rand() * 100) / 10,
      temporal_burst: Math.round(rand() * 100) / 10,
      rarity: Math.round(rand() * 100) / 10,
    });
  }
  return events;
}

export function generateDetectionResults(count: number = 18): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date('2024-06-15T10:00:00');
  const statuses: DetectionResult['status'][] = ['Detected', 'Investigating', 'Contained'];
  const severities: DetectionResult['severity'][] = ['Low', 'Medium', 'High', 'Critical'];

  for (let i = 0; i < count; i++) {
    const ts = new Date(now.getTime() - i * (rand() * 600000 + 120000));
    const severity = severities[Math.floor(rand() * severities.length)];
    const tactic = mitreTactics[Math.floor(rand() * mitreTactics.length)];

    results.push({
      id: `TGD-${String(i + 1).padStart(4, '0')}`,
      timestamp: ts.toISOString(),
      attackType: attackTypes[tactic] || tactic,
      tactic,
      severity,
      sourceNode: randomIP(internalIPs),
      targetNode: rand() > 0.5 ? randomIP(internalIPs) : randomIP(externalIPs),
      confidence: Math.round((rand() * 30 + 70) * 10) / 10,
      graphScore: Math.round((rand() * 40 + 60) * 10) / 10,
      causalDelta: Math.round((rand() * 0.2 + 0.02) * 1000) / 1000,
      status: statuses[Math.floor(rand() * statuses.length)],
      dataset: datasets[Math.floor(rand() * datasets.length)],
    });
  }
  return results;
}

export function generateTimeSeriesData(): TimeSeriesPoint[] {
  const data: TimeSeriesPoint[] = [];
  const now = new Date('2024-06-15T00:00:00');

  for (let i = 0; i < 24; i++) {
    const hour = i;
    const isPeakHour = (hour >= 8 && hour <= 18);
    const baseNormal = isPeakHour ? 80 + Math.floor(rand() * 40) : 20 + Math.floor(rand() * 30);
    const spikeMalicious = (hour === 14 || hour === 15) ? 15 + Math.floor(rand() * 10) : 2 + Math.floor(rand() * 5);

    data.push({
      time: `${String(hour).padStart(2, '0')}:00`,
      normal: baseNormal,
      suspicious: 5 + Math.floor(rand() * 12),
      malicious: spikeMalicious,
      graphScore: Math.round((50 + rand() * 35 + (spikeMalicious > 10 ? 10 : 0)) * 10) / 10,
    });
  }
  return data;
}

// V16_Apex vs baselines — based on scientific evaluation report
export function generateModelMetrics(): ModelMetric[] {
  return [
    { name: 'V16 Apex (TGNN)', precision: 1.000, recall: 0.978, f1Score: 0.989, rocAuc: 0.989, aucPr: 0.956 },
    { name: 'V13 GNN+Reh CL', precision: 0.243, recall: 0.516, f1Score: 0.330, rocAuc: 0.996, aucPr: 0.333 },
    { name: 'GCN Baseline', precision: 0.452, recall: 0.687, f1Score: 0.545, rocAuc: 0.912, aucPr: 0.410 },
    { name: 'GAT Baseline', precision: 0.521, recall: 0.723, f1Score: 0.606, rocAuc: 0.928, aucPr: 0.478 },
    { name: 'Random Forest', precision: 0.389, recall: 0.612, f1Score: 0.475, rocAuc: 0.856, aucPr: 0.321 },
    { name: 'SVM (Linear)', precision: 0.312, recall: 0.548, f1Score: 0.398, rocAuc: 0.801, aucPr: 0.267 },
  ];
}

export function generateGraphStats(): GraphStats {
  return {
    totalNodes: 1847,
    totalEdges: 12453,
    temporalWindows: 48,
    avgClusteringCoeff: 0.342,
    graphDensity: 0.0073,
    connectedComponents: 3,
    embedDim: 64,
    memoryDim: 64,
    numHeads: 4,
    nLayers: 2,
  };
}

export function generateNodeTypeDistribution() {
  return [
    { name: 'Endpoint', value: 42, color: '#3b82f6' },
    { name: 'Server', value: 18, color: '#8b5cf6' },
    { name: 'Router', value: 8, color: '#06b6d4' },
    { name: 'Firewall', value: 5, color: '#f59e0b' },
    { name: 'External', value: 27, color: '#ef4444' },
  ];
}

export function generateThreatTimeline() {
  return [
    { phase: 'Reconnaissance', tactic: 'Reconnaissance', start: 2, duration: 3, severity: 'Low' as const },
    { phase: 'Initial Access', tactic: 'Initial Access', start: 5, duration: 2, severity: 'Medium' as const },
    { phase: 'Lateral Movement', tactic: 'Lateral Movement', start: 7, duration: 4, severity: 'High' as const },
    { phase: 'Data Exfiltration', tactic: 'Exfiltration', start: 11, duration: 2, severity: 'Critical' as const },
    { phase: 'C2 Communication', tactic: 'Command & Control', start: 8, duration: 5, severity: 'High' as const },
    { phase: 'Privilege Escalation', tactic: 'Privilege Escalation', start: 10, duration: 3, severity: 'Critical' as const },
  ];
}

export function generateEdgeTypeDistribution() {
  return [
    { name: 'TCP', value: 35 },
    { name: 'DNS', value: 22 },
    { name: 'Web Traffic', value: 25 },
    { name: 'SSH', value: 8 },
    { name: 'ICMP', value: 5 },
    { name: 'File Transfer', value: 5 },
  ];
}

export function generateProfiles(): UserProfile[] {
  return [
    {
      id: 'prof-001',
      name: 'DARPA Engagement',
      description: 'Analysis profile for DARPA TC engagement dataset with default V16_Apex configuration.',
      dataset: 'DARPA TC v3',
      status: 'active',
      created: '2024-05-20T14:30:00Z',
      lastModified: '2024-06-12T09:15:00Z',
      config: { temporalWindow: 300, memoryDim: 64, numHeads: 4, nLayers: 2, embedDim: 64, threshold: 0.75 },
    },
    {
      id: 'prof-002',
      name: 'UNSW-NB15 Benchmark',
      description: 'Profile configured for UNSW-NB15 network behavior dataset evaluation.',
      dataset: 'UNSW-NB15',
      status: 'inactive',
      created: '2024-06-01T10:00:00Z',
      lastModified: '2024-06-10T16:45:00Z',
      config: { temporalWindow: 600, memoryDim: 64, numHeads: 4, nLayers: 2, embedDim: 64, threshold: 0.80 },
    },
    {
      id: 'prof-003',
      name: 'LANL Traffic',
      description: 'Profile for Los Alamos National Laboratory network flow dataset.',
      dataset: 'LANL NetFlow',
      status: 'inactive',
      created: '2024-06-05T08:20:00Z',
      lastModified: '2024-06-08T11:30:00Z',
      config: { temporalWindow: 120, memoryDim: 64, numHeads: 4, nLayers: 2, embedDim: 64, threshold: 0.70 },
    },
  ];
}

export function generateUploadedDatasets(): UploadedDataset[] {
  return [
    {
      id: 'ds-001', name: 'DARPA_Engagement_TC3.json', format: 'JSON Lines',
      size: '245 MB', events: 1847291, uploadedAt: '2024-05-20T14:30:00Z',
      status: 'processed', source: 'DARPA TC',
    },
    {
      id: 'ds-002', name: 'UNSW_NB15_training.csv', format: 'CSV',
      size: '54 MB', events: 175341, uploadedAt: '2024-06-01T10:05:00Z',
      status: 'processed', source: 'UNSW',
    },
    {
      id: 'ds-003', name: 'LANL_netflow_daily.gz', format: 'Syslog/NetFlow',
      size: '1.2 GB', events: 5243876, uploadedAt: '2024-06-05T08:25:00Z',
      status: 'processed', source: 'LANL',
    },
  ];
}

// ── Per-Source Time Series ───────────────────────────────────────
export interface SourceTimeSeriesPoint {
  time: string;
  darpa: number;
  unsw: number;
  lanl: number;
  fused: number;
}

export function generateSourceTimeSeries(): SourceTimeSeriesPoint[] {
  const data: SourceTimeSeriesPoint[] = [];
  for (let i = 0; i < 24; i++) {
    const isPeak = i >= 8 && i <= 18;
    const spike = (i === 14 || i === 15) ? 12 : 0;
    const darpa = isPeak ? 25 + Math.floor(rand() * 15) + spike : 8 + Math.floor(rand() * 8);
    const unsw = isPeak ? 20 + Math.floor(rand() * 12) + Math.floor(spike * 0.6) : 6 + Math.floor(rand() * 6);
    const lanl = isPeak ? 35 + Math.floor(rand() * 20) + Math.floor(spike * 0.8) : 10 + Math.floor(rand() * 10);
    data.push({
      time: `${String(i).padStart(2, '0')}:00`,
      darpa,
      unsw,
      lanl,
      fused: darpa + unsw + lanl,
    });
  }
  return data;
}

// ── Source Detection Metrics ─────────────────────────────────────
export interface SourceMetric {
  source: string;
  totalEvents: number;
  malicious: number;
  detectionRate: number;
  avgConfidence: number;
  topTactic: string;
}

export function generateSourceMetrics(): SourceMetric[] {
  return [
    { source: 'DARPA TC', totalEvents: 1847291, malicious: 2341, detectionRate: 97.8, avgConfidence: 96.2, topTactic: 'Exfiltration' },
    { source: 'UNSW-NB15', totalEvents: 175341, malicious: 4523, detectionRate: 94.5, avgConfidence: 93.8, topTactic: 'Lateral Movement' },
    { source: 'LANL NetFlow', totalEvents: 5243876, malicious: 1876, detectionRate: 96.1, avgConfidence: 95.4, topTactic: 'C2 Communication' },
  ];
}

// ── Concept Drift Data (Objective 2) ──────────────────────────────
export interface DriftPoint {
  epoch: number;
  withAdaptation: number;
  withoutAdaptation: number;
}

export function generateConceptDriftData(): DriftPoint[] {
  const data: DriftPoint[] = [];
  for (let i = 1; i <= 20; i++) {
    data.push({
      epoch: i,
      withAdaptation: Math.round((96.5 - i * 0.15 + rand() * 2) * 10) / 10,
      withoutAdaptation: Math.round((96.5 - i * 1.8 + rand() * 3) * 10) / 10,
    });
  }
  return data;
}

// ── Concept Drift Accuracy (3-line comparison) ────────────────
export interface DriftAccuracyPoint {
  epoch: number;
  v16Apex: number;
  noRehearsal: number;
  baseline: number;
}

export const driftAccuracyData: DriftAccuracyPoint[] = [
  { epoch: 1,  v16Apex: 89.2, noRehearsal: 88.5, baseline: 87.8 },
  { epoch: 2,  v16Apex: 92.1, noRehearsal: 91.0, baseline: 89.4 },
  { epoch: 3,  v16Apex: 94.3, noRehearsal: 92.8, baseline: 90.1 },
  { epoch: 4,  v16Apex: 95.6, noRehearsal: 93.5, baseline: 90.5 },
  { epoch: 5,  v16Apex: 96.4, noRehearsal: 93.9, baseline: 90.2 },
  { epoch: 6,  v16Apex: 96.8, noRehearsal: 93.6, baseline: 88.7 },
  { epoch: 7,  v16Apex: 97.1, noRehearsal: 92.1, baseline: 85.3 },
  { epoch: 8,  v16Apex: 97.4, noRehearsal: 90.5, baseline: 82.1 },
  { epoch: 9,  v16Apex: 97.2, noRehearsal: 88.9, baseline: 79.4 },
  { epoch: 10, v16Apex: 97.5, noRehearsal: 87.2, baseline: 76.8 },
  { epoch: 11, v16Apex: 97.3, noRehearsal: 85.8, baseline: 74.2 },
  { epoch: 12, v16Apex: 97.6, noRehearsal: 84.1, baseline: 71.9 },
  { epoch: 13, v16Apex: 97.4, noRehearsal: 82.6, baseline: 69.5 },
  { epoch: 14, v16Apex: 97.7, noRehearsal: 81.0, baseline: 67.3 },
  { epoch: 15, v16Apex: 97.5, noRehearsal: 79.5, baseline: 65.1 },
  { epoch: 16, v16Apex: 97.6, noRehearsal: 78.2, baseline: 63.4 },
  { epoch: 17, v16Apex: 97.8, noRehearsal: 76.8, baseline: 61.8 },
  { epoch: 18, v16Apex: 97.5, noRehearsal: 75.5, baseline: 60.2 },
  { epoch: 19, v16Apex: 97.7, noRehearsal: 74.3, baseline: 59.1 },
  { epoch: 20, v16Apex: 97.6, noRehearsal: 73.1, baseline: 58.4 },
];

// ── Attack Backtracking Chain (Objective 3) ──────────────────────
export interface AttackChainStep {
  step: number;
  event: string;
  timestamp: string;
  tactic: string;
  node: string;
  evidence: string;
  attentionWeight: number;
  confidence: number;
}

export function generateAttackChain(): AttackChainStep[] {
  return [
    { step: 1, event: 'Spear-phishing email delivered', timestamp: '08:14:22', tactic: 'Initial Access', node: '192.168.1.35', evidence: 'Email attachment with .docm macro', attentionWeight: 0.94, confidence: 98.7 },
    { step: 2, event: 'Malicious macro executed PowerShell', timestamp: '08:15:03', tactic: 'Execution', node: '192.168.1.35', evidence: 'cmd.exe /c powershell -enc ...', attentionWeight: 0.91, confidence: 97.2 },
    { step: 3, event: 'Registry persistence key created', timestamp: '08:16:11', tactic: 'Persistence', node: '192.168.1.35', evidence: 'HKCU\\...\\Run\\UpdateService', attentionWeight: 0.88, confidence: 96.5 },
    { step: 4, event: 'Mimikatz credential dump', timestamp: '08:22:47', tactic: 'Credential Access', node: '192.168.1.35', evidence: 'sekurlsa::logonpasswords', attentionWeight: 0.96, confidence: 99.1 },
    { step: 5, event: 'Lateral movement via WMI', timestamp: '09:01:33', tactic: 'Lateral Movement', node: '192.168.1.35 → 10.0.0.12', evidence: 'wmic /node:10.0.0.12 process call', attentionWeight: 0.92, confidence: 97.8 },
    { step: 6, event: 'Privilege escalation via token', timestamp: '09:05:18', tactic: 'Privilege Escalation', node: '10.0.0.12', evidence: 'Get-NetworkConnectionInfo token impersonation', attentionWeight: 0.89, confidence: 96.3 },
    { step: 7, event: 'Data staged in hidden directory', timestamp: '09:45:02', tactic: 'Collection', node: '10.0.0.12', evidence: 'C:\\$RecycleBin\\...\\staging\\', attentionWeight: 0.85, confidence: 95.1 },
    { step: 8, event: 'DNS tunneling C2 beacon', timestamp: '10:12:55', tactic: 'Command & Control', node: '10.0.0.12 → 23.129.64.100', evidence: 'Long TXT query to 4g2d.evil.com', attentionWeight: 0.97, confidence: 99.3 },
    { step: 9, event: 'Data exfiltration via HTTPS', timestamp: '11:03:41', tactic: 'Exfiltration', node: '10.0.0.12 → 104.236.198.48', evidence: '2.4GB encrypted POST to /api/v2/upload', attentionWeight: 0.98, confidence: 99.6 },
  ];
}

// ── Temporal Explainability (Objective 4) ─────────────────────────
export interface ExplainabilityEntry {
  eventId: string;
  timestamp: string;
  source: string;
  tactic: string;
  attentionWeight: number;
  temporalContribution: number;
  graphNeighborhood: number;
  classification: string;
  reasoning: string;
}

export function generateExplainabilityData(): ExplainabilityEntry[] {
  return [
    { eventId: 'TGD-0001', timestamp: '08:14:22', source: 'DARPA', tactic: 'Initial Access', attentionWeight: 0.94, temporalContribution: 0.31, graphNeighborhood: 4, classification: 'Malicious', reasoning: 'First event in causal chain — email→endpoint edge with high burst score' },
    { eventId: 'TGD-0003', timestamp: '08:15:03', source: 'DARPA', tactic: 'Execution', attentionWeight: 0.91, temporalContribution: 0.28, graphNeighborhood: 5, classification: 'Malicious', reasoning: 'Temporal proximity to initial access + unusual process spawn pattern' },
    { eventId: 'TGD-0005', timestamp: '08:22:47', source: 'DARPA', tactic: 'Credential Access', attentionWeight: 0.96, temporalContribution: 0.42, graphNeighborhood: 7, classification: 'Malicious', reasoning: 'High attention due to rare LSASS access + temporal correlation with lateral movement' },
    { eventId: 'TGD-0007', timestamp: '09:01:33', source: 'LANL', tactic: 'Lateral Movement', attentionWeight: 0.92, temporalContribution: 0.38, graphNeighborhood: 6, classification: 'Malicious', reasoning: 'Cross-subnet connection matching pass-the-hash pattern + temporal burst' },
    { eventId: 'TGD-0009', timestamp: '10:12:55', source: 'UNSW', tactic: 'Command & Control', attentionWeight: 0.97, temporalContribution: 0.45, graphNeighborhood: 8, classification: 'Malicious', reasoning: 'Periodic DNS beacon detected via temporal encoding + high rarity score' },
    { eventId: 'TGD-0012', timestamp: '11:03:41', source: 'UNSW', tactic: 'Exfiltration', attentionWeight: 0.98, temporalContribution: 0.51, graphNeighborhood: 9, classification: 'Malicious', reasoning: 'Large outbound transfer to rare external node + temporal correlation with C2 phase' },
  ];
}

export const supportedLogFormats = [
  { name: 'CSV', desc: 'Comma-separated values (columns: src_ip, dst_ip, timestamp, ...)', ext: '.csv', icon: 'table' as const },
  { name: 'JSON Lines', desc: 'One JSON object per line with event fields', ext: '.jsonl', icon: 'braces' as const },
  { name: 'JSON Array', desc: 'Standard JSON array of event objects', ext: '.json', icon: 'file-json' as const },
  { name: 'Syslog / RFC 5424', desc: 'Standard syslog format with structured data', ext: '.log', icon: 'terminal' as const },
  { name: 'NetFlow v5/v9', desc: 'Cisco NetFlow binary or text export', ext: '.nfdump', icon: 'network' as const },
  { name: 'Wazuh JSON', desc: 'Wazuh EDR alerts in JSON format', ext: '.json', icon: 'shield' as const },
  { name: 'Zeek JSON', desc: 'Zeek/Bro network logs in TSV or JSON', ext: '.json', icon: 'search' as const },
  { name: 'Apache / Nginx', desc: 'Common/Combined access log format', ext: '.log', icon: 'globe' as const },
  { name: 'Windows Event Log', desc: 'Windows EVT/XML event logs', ext: '.evtx', icon: 'monitor' as const },
  { name: 'CEF', desc: 'Common Event Format (ArcSight)', ext: '.log', icon: 'file-text' as const },
  { name: 'PCAP Extracted', desc: 'Network captures exported as flow logs', ext: '.csv', icon: 'wifi' as const },
  { name: 'SURICATA EVE', desc: 'Suricata IDS EVE JSON log format', ext: '.json', icon: 'alert-triangle' as const },
];

// ── Log Source Type Breakdown (GAP C1) ──
export const logSourceTypeData = [
  { name: 'Authentication', count: 1240000, color: 'hsl(var(--chart-1))' },
  { name: 'Network Traffic', count: 4820000, color: 'hsl(var(--chart-6))' },
  { name: 'System Events', count: 380000, color: 'hsl(var(--chart-2))' },
  { name: 'DNS Activity', count: 410000, color: 'hsl(var(--chart-4))' },
  { name: 'Cloud Events', count: 80000, color: 'hsl(var(--chart-3))' },
];

// ── UniversalEncoder Feature Weights (GAP C2) ──
export const universalEncoderWeights = [
  { name: 'Hash-ID Embedding', weight: 38.2 },
  { name: 'Frequency', weight: 24.1 },
  { name: 'Temporal Burst', weight: 21.4 },
  { name: 'Rarity', weight: 16.3 },
];

// ── Domain Invariance (GAP C5) ──
export const domainInvarianceData = [
  { name: 'DARPA TC', score: 31.2 },
  { name: 'UNSW-NB15', score: 34.7 },
  { name: 'LANL NetFlow', score: 34.1 },
];
export const domainConfusionScore = 96.8;

// ── Rehearsal Buffer Status (GAP C7) ──
export const rehearsalBufferData = {
  capacity: 4847,
  max: 5000,
  sources: [
    { name: 'DARPA TC', count: 1920 },
    { name: 'UNSW-NB15', count: 1587 },
    { name: 'LANL NetFlow', count: 1340 },
  ],
};

// ── Drift Distance Gauge (GAP C8) ──
export const driftDistanceData = {
  current: 0.183,
  limit: 0.250,
  percentage: 73.2,
  threshold: 0.250,
  status: 'STABLE',
  sparkline: [
    { t: '00:00', d: 0.052 }, { t: '02:00', d: 0.061 }, { t: '04:00', d: 0.058 },
    { t: '06:00', d: 0.072 }, { t: '08:00', d: 0.089 }, { t: '10:00', d: 0.112 },
    { t: '12:00', d: 0.134 }, { t: '14:00', d: 0.156 }, { t: '16:00', d: 0.168 },
    { t: '18:00', d: 0.179 }, { t: '20:00', d: 0.183 }, { t: '22:00', d: 0.177 },
  ],
};

// ── Attack Chain Path Scores (GAP C9) ──
export const attackChainPathScores: number[] = [0.891, 0.904, 0.887, 0.951, 0.922, 0.908, 0.876, 0.941, 0.963];

// ── Cross-Source Correlations (D2) ──
export const crossSourceCorrelations = [
  { id: 'CORR-0041', srcA: 'DARPA TC', srcB: 'LANL Flow', dt: '0.8s', node: '10.0.0.12', score: 0.94 },
  { id: 'CORR-0038', srcA: 'UNSW-NB15', srcB: 'LANL Flow', dt: '1.2s', node: '10.0.0.15', score: 0.87 },
  { id: 'CORR-0052', srcA: 'DARPA TC', srcB: 'UNSW-NB15', dt: '2.1s', node: '192.168.1.35', score: 0.91 },
  { id: 'CORR-0019', srcA: 'LANL Flow', srcB: 'DARPA TC', dt: '0.4s', node: '10.0.0.12', score: 0.98 },
];

// ── Tactic Embedding Clusters (GAP C6) ──
export const tacticEmbeddingClusters = [
  { name: 'Initial Access', cluster: 0, x: -3.2, y: 2.1 },
  { name: 'Execution', cluster: 1, x: 2.8, y: -1.5 },
  { name: 'Credential Access', cluster: 2, x: -1.1, y: -3.4 },
  { name: 'Lateral Movement', cluster: 3, x: 3.5, y: 1.8 },
  { name: 'C2', cluster: 4, x: -2.5, y: 0.8 },
  { name: 'Exfiltration', cluster: 5, x: 0.9, y: 3.2 },
  { name: 'Phishing (IA)', cluster: 0, x: -3.8, y: 2.6 },
  { name: 'Exploit (IA)', cluster: 0, x: -2.7, y: 1.5 },
  { name: 'PowerShell (EX)', cluster: 1, x: 3.2, y: -1.0 },
  { name: 'WMI (EX)', cluster: 1, x: 2.3, y: -2.1 },
  { name: 'Mimikatz (CA)', cluster: 2, x: -0.8, y: -3.8 },
  { name: 'Pass-the-Hash (CA)', cluster: 2, x: -1.6, y: -2.9 },
  { name: 'RDP (LM)', cluster: 3, x: 3.9, y: 2.3 },
  { name: 'PsExec (LM)', cluster: 3, x: 3.0, y: 1.2 },
  { name: 'DNS Tunnel (C2)', cluster: 4, x: -3.0, y: 1.2 },
  { name: 'HTTP Beacon (C2)', cluster: 4, x: -2.0, y: 0.3 },
  { name: 'HTTPS Exfil (EF)', cluster: 5, x: 1.3, y: 3.6 },
  { name: 'Covert Ch (EF)', cluster: 5, x: 0.5, y: 2.7 },
];

// ── SupCon Metrics (E1) ──
export const supConMetrics = {
  tacticSeparation: 8.3,
  clusterCompactness: 0.94,
};
