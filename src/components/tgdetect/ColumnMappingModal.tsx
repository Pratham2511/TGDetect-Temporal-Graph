'use client';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  X, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft,
  FileSearch, Columns3, Cpu, CheckCircle, ArrowRightLeft,
} from 'lucide-react';

interface ColumnMappingModalProps {
  fileName: string;
  onClose: () => void;
  onComplete: () => void;
}

// TGDetect expected fields with descriptions
const TGDetect_FIELDS = [
  { key: 'src_ip', label: 'Source IP', desc: 'Originating IP address', required: true },
  { key: 'dst_ip', label: 'Destination IP', desc: 'Target IP address', required: true },
  { key: 'timestamp', label: 'Timestamp', desc: 'Event timestamp (ISO/Unix/Custom)', required: true },
  { key: 'protocol', label: 'Protocol', desc: 'Transport protocol (TCP/UDP/ICMP)', required: false },
  { key: 'src_port', label: 'Source Port', desc: 'Originating port number', required: false },
  { key: 'dst_port', label: 'Destination Port', desc: 'Target port number', required: false },
  { key: 'bytes', label: 'Bytes Transferred', desc: 'Data volume in bytes', required: false },
  { key: 'event_type', label: 'Event Type', desc: 'Classification (normal/suspicious/malicious)', required: false },
  { key: 'threat_score', label: 'Threat Score', desc: 'Severity score (0-100)', required: false },
  { key: 'labels', label: 'Labels', desc: 'Attack category labels', required: false },
];

// Simulated detected columns from the uploaded file
const DETECTED_COLUMNS = [
  { name: 'source_address', type: 'IPv4', sample: '192.168.1.35', confidence: 0.95, suggestedMapping: 'src_ip' },
  { name: 'dest_address', type: 'IPv4', sample: '10.0.0.12', confidence: 0.92, suggestedMapping: 'dst_ip' },
  { name: 'event_time', type: 'DateTime', sample: '2024-06-15T08:14:22Z', confidence: 0.88, suggestedMapping: 'timestamp' },
  { name: 'proto', type: 'String', sample: 'TCP', confidence: 0.85, suggestedMapping: 'protocol' },
  { name: 'src_port', type: 'Integer', sample: '52431', confidence: 0.98, suggestedMapping: 'src_port' },
  { name: 'dst_port', type: 'Integer', sample: '443', confidence: 0.97, suggestedMapping: 'dst_port' },
  { name: 'bytes_sent', type: 'Integer', sample: '24576', confidence: 0.78, suggestedMapping: 'bytes' },
  { name: 'classification', type: 'String', sample: 'malicious', confidence: 0.72, suggestedMapping: 'event_type' },
  { name: 'severity', type: 'Float', sample: '0.87', confidence: 0.65, suggestedMapping: 'threat_score' },
  { name: 'category', type: 'String', sample: 'Exfiltration', confidence: 0.60, suggestedMapping: 'labels' },
  { name: 'user_agent', type: 'String', sample: 'Mozilla/5.0...', confidence: 0.15, suggestedMapping: null },
  { name: 'packet_ttl', type: 'Integer', sample: '64', confidence: 0.10, suggestedMapping: null },
];

const PROCESSING_STEPS = [
  { label: 'Parsing rows...', duration: 1200 },
  { label: 'Validating schema...', duration: 800 },
  { label: 'Building temporal graph...', duration: 1000 },
  { label: 'Running TGNN inference...', duration: 1500 },
  { label: 'Generating embeddings...', duration: 800 },
  { label: 'Complete', duration: 0 },
];

export function ColumnMappingModal({ fileName, onClose, onComplete }: ColumnMappingModalProps) {
  const [step, setStep] = useState(1);
  const [scanning, setScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [mappings, setMappings] = useState<Record<string, string>>(
    Object.fromEntries(DETECTED_COLUMNS.filter(c => c.suggestedMapping).map(c => [c.name, c.suggestedMapping!]))
  );
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Step 1: Simulate scanning
  useEffect(() => {
    if (step !== 1 || !scanning) return;
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          setScanning(false);
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [step, scanning]);

  // Step 3: Simulate processing
  useEffect(() => {
    if (step !== 3) return;
    let currentStep = 0;
    const runStep = () => {
      if (currentStep >= PROCESSING_STEPS.length) return;
      const stepInfo = PROCESSING_STEPS[currentStep];
      setProcessingStep(currentStep);

      if (stepInfo.duration === 0) {
        // Complete - wait 1s then call onComplete
        setTimeout(onComplete, 1000);
        return;
      }

      setProcessingProgress(0);
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            currentStep++;
            setTimeout(runStep, 300);
            return 100;
          }
          return prev + 100 / (stepInfo.duration / 50);
        });
      }, 50);
    };
    runStep();
  }, [step, onComplete]);

  const unmappedRequiredCount = DETECTED_COLUMNS.filter(c => c.suggestedMapping && !mappings[c.name]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-3xl shadow-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 w-8 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-emerald-400' : 'bg-[var(--bg-input)]'
                }`} />
              ))}
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Step {step} of 3 — {step === 1 ? 'File Analysis' : step === 2 ? 'Column Mapping' : 'Processing'}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: File Analysis */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <FileSearch className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Analyzing: {fileName}</h3>
              </div>

              {scanning ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--text-secondary)]">Scanning file structure and content...</span>
                  </div>
                  <Progress value={Math.min(scanProgress, 100)} className="h-1.5 bg-[var(--bg-input)]" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Rows Detected', value: '523,340' },
                      { label: 'Format', value: 'CSV' },
                      { label: 'Columns', value: String(DETECTED_COLUMNS.length) },
                      { label: 'Size', value: '12.4 MB' },
                    ].map(item => (
                      <div key={item.label} className="bg-[var(--bg-input)] rounded-lg p-3 text-center">
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{item.label}</p>
                        <p className="text-base font-semibold text-[var(--text-primary)] mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <Separator className="bg-[var(--border-secondary)]" />
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">Data Quality Assessment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Quality Score', value: '94.2%', color: 'text-emerald-400', bar: 94.2 },
                        { label: 'Completeness', value: '98.1%', color: 'text-emerald-400', bar: 98.1 },
                        { label: 'Consistency', value: '91.7%', color: 'text-cyan-400', bar: 91.7 },
                        { label: 'Duplicate Rate', value: '0.3%', color: 'text-emerald-400', bar: 99.7 },
                      ].map(q => (
                        <div key={q.label} className="bg-[var(--bg-input)] rounded-lg p-3">
                          <p className="text-[10px] text-[var(--text-muted)]">{q.label}</p>
                          <p className={`text-sm font-semibold ${q.color} mt-1`}>{q.value}</p>
                          <Progress value={q.bar} className="h-1 bg-[var(--bg-card)] mt-1.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-input)] rounded-lg p-3">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Timestamp Range</p>
                    <p className="text-xs font-mono text-[var(--text-secondary)]">2024-06-15T00:00:00Z → 2024-06-15T23:59:59Z (24 hours)</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Columns3 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Map Your Columns to TGDetect Fields</h3>
                </div>
                <Badge className={`text-[10px] ${unmappedRequiredCount === 0 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-amber-400/10 text-amber-400 border-amber-400/20'}`}>
                  {unmappedRequiredCount === 0 ? 'All required fields mapped' : `${unmappedRequiredCount} unmapped required fields`}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Map your file&apos;s columns to TGDetect&apos;s expected fields. Required fields are marked with <span className="text-red-400">*</span>.
                Auto-detected mappings are pre-filled based on column name analysis.
              </p>

              {/* Mapping Table */}
              <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
                <div className="grid grid-cols-[1fr_40px_1fr] gap-0 bg-[var(--bg-input)] px-4 py-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Your Column</span>
                  <span />
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">TGDetect Field</span>
                </div>
                <div className="divide-y divide-[var(--border-secondary)]">
                  {DETECTED_COLUMNS.map(col => {
                    const isMapped = !!mappings[col.name];
                    const confidence = col.confidence;
                    return (
                      <div key={col.name} className="grid grid-cols-[1fr_40px_1fr] gap-0 px-4 py-2.5 items-center hover:bg-[var(--bg-card-hover)] transition-colors">
                        {/* Source Column */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            confidence > 0.8 ? 'bg-emerald-400' :
                            confidence > 0.5 ? 'bg-amber-400' : 'bg-[var(--text-muted)]'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] font-mono truncate">{col.name}</p>
                            <p className="text-[9px] text-[var(--text-muted)] truncate">{col.type} · {col.sample}</p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--text-muted)] mx-auto shrink-0" />

                        {/* TGDetect Field Dropdown */}
                        <select
                          value={mappings[col.name] || ''}
                          onChange={(e) => setMappings(prev => ({ ...prev, [col.name]: e.target.value }))}
                          className="text-xs bg-[var(--bg-input)] border border-[var(--border-secondary)] rounded-md px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-emerald-400/50 appearance-none cursor-pointer min-w-0"
                        >
                          <option value="">— Skip —</option>
                          {TGDetect_FIELDS.map(field => (
                            <option key={field.key} value={field.key} disabled={Object.values(mappings).includes(field.key) && mappings[col.name] !== field.key}>
                              {field.label}{field.required ? ' *' : ''} — {field.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-2 bg-[var(--bg-input)] rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-medium text-[var(--text-primary)]">Required fields:</span> src_ip, dst_ip, and timestamp must be mapped for TGNN temporal graph construction.
                  Unmapped optional fields will be ignored during processing. Confidence indicators show how well your column names match TGDetect&apos;s expected schema.
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="space-y-5 py-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Processing Dataset</h3>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                {PROCESSING_STEPS.map((s, idx) => {
                  const isActive = idx === processingStep;
                  const isDone = idx < processingStep;
                  const isLast = idx === PROCESSING_STEPS.length - 1;
                  const isComplete = isDone || (isLast && processingStep === PROCESSING_STEPS.length - 1);
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-emerald-400/10 border border-emerald-400/30' :
                          isActive ? 'bg-emerald-400/10 border border-emerald-400/30 animate-pulse' :
                          'bg-[var(--bg-input)] border border-[var(--border-secondary)]'
                      }`}>
                        {isComplete ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isActive ? (
                          <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${isComplete ? 'text-emerald-400' : isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                          {s.label}
                        </p>
                        {isActive && (
                          <Progress value={Math.min(processingProgress, 100)} className="h-1 bg-[var(--bg-input)] mt-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-primary)]">
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--text-muted)]"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={step === 3}
          >
            {step === 1 ? 'Cancel' : (
              <><ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back</>
            )}
          </Button>
          <div className="flex items-center gap-2">
            {step < 3 && (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && scanning}
              >
                {step === 2 ? 'Start Processing' : 'Continue'}
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
