// TGDetect Synthetic Data Generator
// Generates realistic-looking demo data for the panel presentation

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
}

export interface DetectionResult {
  id: string;
  timestamp: string;
  attackType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  sourceNode: string;
  targetNode: string;
  confidence: number;
  graphScore: number;
  status: 'Detected' | 'Investigating' | 'Contained';
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
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  temporalWindows: number;
  avgClusteringCoeff: number;
  graphDensity: number;
  connectedComponents: number;
}

// Seeded random for consistent demo data
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
const attackTypes = [
  'Port Scanning', 'Brute Force SSH', 'DNS Tunneling', 'Data Exfiltration',
  'Lateral Movement', 'C2 Communication', 'Privilege Escalation',
  'Credential Stuffing', 'Reconnaissance', 'APT Beacon',
];

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
    });
  }

  return events;
}

export function generateDetectionResults(count: number = 15): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date('2024-06-15T10:00:00');
  const statuses: DetectionResult['status'][] = ['Detected', 'Investigating', 'Contained'];
  const severities: DetectionResult['severity'][] = ['Low', 'Medium', 'High', 'Critical'];

  for (let i = 0; i < count; i++) {
    const ts = new Date(now.getTime() - i * (rand() * 600000 + 120000));
    const severity = severities[Math.floor(rand() * severities.length)];

    results.push({
      id: `TGD-${String(i + 1).padStart(4, '0')}`,
      timestamp: ts.toISOString(),
      attackType: attackTypes[Math.floor(rand() * attackTypes.length)],
      severity,
      sourceNode: randomIP(internalIPs),
      targetNode: rand() > 0.5 ? randomIP(internalIPs) : randomIP(externalIPs),
      confidence: Math.round((rand() * 30 + 70) * 10) / 10,
      graphScore: Math.round((rand() * 40 + 60) * 10) / 10,
      status: statuses[Math.floor(rand() * statuses.length)],
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

export function generateModelMetrics(): ModelMetric[] {
  return [
    { name: 'TGNN (Ours)', accuracy: 96.8, precision: 95.2, recall: 97.1, f1Score: 96.1 },
    { name: 'GCN', accuracy: 89.3, precision: 87.6, recall: 91.0, f1Score: 89.3 },
    { name: 'GAT', accuracy: 91.5, precision: 90.1, recall: 93.2, f1Score: 91.6 },
    { name: 'Random Forest', accuracy: 82.4, precision: 80.8, recall: 84.2, f1Score: 82.5 },
    { name: 'SVM', accuracy: 78.9, precision: 76.3, recall: 81.5, f1Score: 78.8 },
    { name: 'MLP', accuracy: 85.7, precision: 83.9, recall: 87.4, f1Score: 85.6 },
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
    { phase: 'Reconnaissance', start: 2, duration: 3, severity: 'Low' },
    { phase: 'Initial Access', start: 5, duration: 2, severity: 'Medium' },
    { phase: 'Lateral Movement', start: 7, duration: 4, severity: 'High' },
    { phase: 'Data Exfiltration', start: 11, duration: 2, severity: 'Critical' },
    { phase: 'C2 Setup', start: 8, duration: 5, severity: 'High' },
    { phase: 'Privilege Escalation', start: 10, duration: 3, severity: 'Critical' },
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
