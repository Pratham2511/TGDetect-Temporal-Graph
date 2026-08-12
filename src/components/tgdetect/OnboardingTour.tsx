'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, Upload, UserCircle,
  ChevronRight, ChevronLeft, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/lib/theme-context';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'left' | 'right' | 'bottom' | 'center';
  icon: React.ComponentType<{ className?: string }>;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-sidebar',
    title: 'Welcome to TGDetect',
    description: 'Your AI-powered threat detection platform powered by Temporal Graph Neural Networks. Let us give you a quick tour of the interface.',
    position: 'right',
    icon: Shield,
  },
  {
    targetId: 'tour-dashboard',
    title: 'Dashboard Overview',
    description: 'Get a real-time view of your detection pipeline. Monitor live event ingestion, threat metrics, network traffic patterns, and recent detection alerts — all powered by the V16 Apex TGNN model.',
    position: 'right',
    icon: LayoutDashboard,
  },
  {
    targetId: 'tour-analytics',
    title: 'Deep Analytics',
    description: 'Dive deep into detection analytics across DARPA TC, UNSW-NB15, and LANL NetFlow sources. View per-source metrics, fused temporal graph analysis, concept drift adaptation, and the Threat Intelligence section for attack backtracking and explainability.',
    position: 'right',
    icon: BarChart3,
  },
  {
    targetId: 'tour-datasets',
    title: 'Dataset Management',
    description: 'Upload your network logs in 12+ formats including CSV, JSON, Syslog, NetFlow, Zeek, and Suricata EVE. Our smart column mapper auto-detects your schema and maps it to TGDetect\'s expected fields.',
    position: 'right',
    icon: Upload,
  },
  {
    targetId: 'tour-profiles',
    title: 'Analysis Profiles',
    description: 'Create dedicated profiles for different datasets and investigations. Each profile maintains its own V16 Apex configuration — temporal window, memory dimensions, attention heads, and detection thresholds.',
    position: 'right',
    icon: UserCircle,
  },
  {
    targetId: 'tour-pulse',
    title: 'Live System Monitoring',
    description: 'The system pulse bar shows real-time ingestion metrics: events per second, active nodes, graph edges, and memory usage. The live activity feed streams detection events, alerts, and system updates as they happen.',
    position: 'bottom',
    icon: Shield,
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { theme } = useTheme();
  const PADDING = 10;

  const step = TOUR_STEPS[currentStep];

  // Theme-aware colors
  const isDark = theme === 'dark';
  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.55)';
  const overlayBackdrop = isDark ? 'blur(1px)' : 'blur(3px)';
  const highlightBorder = isDark ? 'rgba(96, 165, 250, 0.8)' : 'rgba(37, 99, 235, 0.7)';
  const highlightGlow = isDark
    ? '0 0 0 1px rgba(96, 165, 250, 0.3), 0 0 16px rgba(96, 165, 250, 0.15), 0 0 40px rgba(96, 165, 250, 0.08)'
    : '0 0 0 1px rgba(37, 99, 235, 0.2), 0 0 12px rgba(37, 99, 235, 0.1)';
  const highlightBg = isDark
    ? 'rgba(96, 165, 250, 0.04)'
    : 'rgba(37, 99, 235, 0.03)';
  const cornerColor = isDark ? 'rgb(147, 197, 253)' : 'rgb(59, 130, 246)';
  const accentColor = isDark ? 'rgb(96, 165, 250)' : 'rgb(37, 99, 235)';
  const accentBg = isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)';

  // Measure the target element and position the tooltip
  const measureTarget = useCallback(() => {
    if (step.position === 'center') {
      setTargetRect(null);
      return;
    }
    const el = document.getElementById(step.targetId);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    // Position the tooltip relative to the target
    let tooltipTop = 0;
    let tooltipLeft = 0;

    if (step.position === 'right') {
      tooltipTop = rect.top + rect.height / 2 - 60;
      tooltipLeft = rect.right + PADDING + 16;
    } else if (step.position === 'bottom') {
      tooltipTop = rect.bottom + PADDING + 16;
      tooltipLeft = rect.left + rect.width / 2 - 160;
    } else if (step.position === 'left') {
      tooltipTop = rect.top + rect.height / 2 - 60;
      tooltipLeft = rect.left - PADDING - 336;
    }

    // Clamp tooltip within viewport
    tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - 340));
    tooltipTop = Math.max(12, Math.min(tooltipTop, window.innerHeight - 200));

    setTooltipPos({ top: tooltipTop, left: tooltipLeft });
  }, [step]);

  useEffect(() => {
    // Small delay to let the DOM settle after step change
    const timer = setTimeout(measureTarget, 50);
    window.addEventListener('resize', measureTarget);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureTarget);
    };
  }, [measureTarget]);

  const goToStep = useCallback((direction: 1 | -1) => {
    const nextIdx = currentStep + direction;
    if (nextIdx < 0 || nextIdx >= TOUR_STEPS.length) {
      if (direction === 1) onComplete();
      return;
    }
    setIsTransitioning(true);
    setTargetRect(null);
    setTimeout(() => {
      setCurrentStep(nextIdx);
      setIsTransitioning(false);
    }, 250);
  }, [currentStep, onComplete]);

  const skipTour = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') goToStep(1);
      if (e.key === 'ArrowLeft') goToStep(-1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToStep, skipTour]);

  if (!isVisible) return null;

  // ─── Center modal (welcome step) ──────────────────────────────────
  if (step.position === 'center') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: overlayBg, backdropFilter: overlayBackdrop }}>
        <div className={`bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-lg shadow-2xl mx-4 transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{step.title}</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">{step.description}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-8' : 'w-2'
                }`} style={{ backgroundColor: i === currentStep ? accentColor : 'var(--bg-input)' }} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-[var(--text-muted)]" onClick={skipTour}>
                Skip Tour
              </Button>
              <Button size="sm" className="text-white" style={{ backgroundColor: accentColor }} onClick={() => goToStep(1)}>
                Get Started <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Spotlight steps ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100]">
      {/* SVG Overlay with cutout hole */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'auto' }}
      >
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill={overlayBg}
          mask="url(#tour-spotlight)"
          style={{ backdropFilter: overlayBackdrop }}
        />
      </svg>

      {/* Highlight ring around the target — subtle, theme-aware */}
      {targetRect && (
        <div
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '10px',
            border: `1.5px solid ${highlightBorder}`,
            boxShadow: highlightGlow,
            background: highlightBg,
          }}
        >
          {/* Animated scanning line */}
          <div
            className="absolute left-0 right-0 h-[1px] opacity-40"
            style={{
              top: '0%',
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              animation: 'tour-scan 2.5s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Tooltip */}
      <div
        className={`absolute pointer-events-auto transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Connector line to target */}
        {step.position === 'right' && targetRect && (
          <div
            className="absolute -left-6 top-[72px] w-6 h-[1px]"
            style={{ background: `${accentColor}40` }}
          />
        )}
        {step.position === 'bottom' && targetRect && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-[1px] h-6"
            style={{ background: `${accentColor}40` }}
          />
        )}

        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-80 shadow-2xl" style={isDark ? { boxShadow: '0 25px 50px rgba(0,0,0,0.5)' } : { boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: accentBg, border: `1px solid ${accentColor}30` }}
                >
                  <step.icon className="w-4 h-4" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                  <Badge className="text-[9px] bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-secondary)] mt-0.5">
                    {currentStep + 1} / {TOUR_STEPS.length}
                  </Badge>
                </div>
              </div>
              <button onClick={skipTour} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">{step.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-4' : 'w-1.5'
                  }`} style={{ backgroundColor: i === currentStep ? accentColor : 'var(--bg-input)' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-[var(--text-muted)] h-7 gap-0.5"
                    onClick={() => goToStep(-1)}
                  >
                    <ChevronLeft className="w-3 h-3" /> Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-[10px] text-[var(--text-muted)] h-7" onClick={skipTour}>
                  Skip
                </Button>
                <Button size="sm" className="text-white h-7 text-xs" style={{ backgroundColor: accentColor }} onClick={() => goToStep(1)}>
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animation for the scan line */}
      <style jsx>{`
        @keyframes tour-scan {
          0%, 100% { top: 5%; opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          50% { top: 95%; }
        }
      `}</style>
    </div>
  );
}
