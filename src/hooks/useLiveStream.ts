'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// Generates a small random delta for demo streaming effect
function randomDelta(base: number, range: number): number {
  return Math.round(base + (Math.random() - 0.3) * range);
}

export interface LiveMetrics {
  totalEvents: number;
  eventsPerSecond: number;
  activeNodes: number;
  threatsDetected: number;
  graphEdges: number;
  memoryUsage: number;
  lastEventTime: string;
}

export function useLiveStream() {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    totalEvents: 7265901,
    eventsPerSecond: 342,
    activeNodes: 1847,
    threatsDetected: 18,
    graphEdges: 12453,
    memoryUsage: 67.3,
    lastEventTime: '刚刚',
  });
  const [feedItems, setFeedItems] = useState<Array<{
    id: string;
    type: 'detection' | 'ingestion' | 'alert' | 'system';
    message: string;
    timestamp: string;
    source?: string;
  }>>([]);
  const counterRef = useRef(0);

  // Update metrics every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        totalEvents: prev.totalEvents + randomDelta(15, 30),
        eventsPerSecond: randomDelta(342, 80),
        activeNodes: randomDelta(1847, 12),
        threatsDetected: Math.max(0, prev.threatsDetected + (Math.random() > 0.7 ? 1 : 0)),
        graphEdges: prev.graphEdges + randomDelta(5, 20),
        memoryUsage: Math.min(95, Math.max(45, prev.memoryUsage + (Math.random() - 0.5) * 2)),
        lastEventTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Add feed items every 5-8 seconds
  useEffect(() => {
    const templates = [
      { type: 'ingestion' as const, message: 'Ingested 1,247 events from DARPA TC stream', source: 'DARPA' },
      { type: 'ingestion' as const, message: 'Ingested 892 events from UNSW-NB15 batch', source: 'UNSW' },
      { type: 'ingestion' as const, message: 'Ingested 2,103 events from LANL NetFlow', source: 'LANL' },
      { type: 'detection' as const, message: 'New detection: Suspicious DNS tunneling pattern detected', source: 'UNSW' },
      { type: 'detection' as const, message: 'New detection: Anomalous lateral movement between subnets', source: 'DARPA' },
      { type: 'alert' as const, message: 'High-severity alert: Credential dump via LSASS access', source: 'DARPA' },
      { type: 'alert' as const, message: 'Critical: Large outbound transfer to known C2 IP', source: 'LANL' },
      { type: 'system' as const, message: 'Temporal graph updated — 12 new edges added' },
      { type: 'system' as const, message: 'Concept drift check passed — model accuracy stable at 97.2%' },
      { type: 'system' as const, message: 'Rehearsal buffer rotated — 10% snapshot refreshed' },
      { type: 'ingestion' as const, message: 'Ingested 567 events from Zeek JSON log', source: 'UNSW' },
      { type: 'detection' as const, message: 'Detection confidence updated for TGD-0042: 96.8%', source: 'DARPA' },
    ];

    const addFeedItem = () => {
      const template = templates[Math.floor(Math.random() * templates.length)];
      counterRef.current += 1;
      const item = {
        id: `feed-${counterRef.current}`,
        ...template,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      };
      setFeedItems(prev => [item, ...prev].slice(0, 20));
    };

    // Add initial items
    for (let i = 0; i < 5; i++) {
      const template = templates[i % templates.length];
      counterRef.current += 1;
      const d = new Date(Date.now() - (5 - i) * 8000);
      setFeedItems(prev => [{
        id: `feed-${counterRef.current}`,
        ...template,
        timestamp: d.toLocaleTimeString('en-US', { hour12: false }),
      }, ...prev]);
    }

    const interval = setInterval(addFeedItem, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  return { metrics, feedItems };
}
