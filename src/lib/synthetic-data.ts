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
    { name: 'TCP Connection', value: 35 },
    { name: 'DNS Query', value: 22 },
    { name: 'HTTP/HTTPS', value: 25 },
    { name: 'SSH Session', value: 8 },
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
