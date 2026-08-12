'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, Upload, UserCircle,
  ChevronRight, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const animationRef = useRef<number | null>(null);
  const PADDING = 10;

  const step = TOUR_STEPS[currentStep];

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
    measureTarget();
    // Re-measure on resize
    window.addEventListener('resize', measureTarget);
    return () => window.removeEventListener('resize', measureTarget);
  }, [measureTarget]);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setIsTransitioning(true);
      setTargetRect(null);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 250);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const skipTour = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      if (e.key === 'ArrowLeft' && currentStep > 0) {
        setIsTransitioning(true);
        setTargetRect(null);
        setTimeout(() => {
          setCurrentStep(prev => prev - 1);
          setIsTransitioning(false);
        }, 250);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStep, skipTour, currentStep]);

  if (!isVisible) return null;

  // For center position (welcome step), show centered modal
  if (step.position === 'center') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
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
                  i === currentStep ? 'w-8 bg-emerald-400' : 'w-2 bg-[var(--bg-input)]'
                }`} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-[var(--text-muted)]" onClick={skipTour}>
                Skip Tour
              </Button>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={nextStep}>
                Get Started <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Build SVG spotlight path that creates a "hole" around the target element
  const spotlightPath = targetRect
    ? `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z
       M${targetRect.left},${targetRect.top}
       h${targetRect.width} v${targetRect.height}
       h-${targetRect.width} Z`
    : '';

  const spotlightRadius = targetRect
    ? Math.max(targetRect.width, targetRect.height) / 2 + 20
    : 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* SVG Spotlight Overlay — the black area with a transparent hole */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ filter: 'blur(0.5px)' }}
      >
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Cut out the target area */}
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#tour-spotlight)"
        />
      </svg>

      {/* Pulsing highlight ring around the target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        >
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 rounded-lg border-2 border-emerald-400/60 animate-pulse" />
          {/* Inner bright ring */}
          <div className="absolute inset-0 rounded-lg border-[3px] border-emerald-400/90" />
          {/* Corner accents */}
          <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-[3px] border-l-[3px] border-emerald-300 rounded-tl-lg" />
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-[3px] border-r-[3px] border-emerald-300 rounded-tr-lg" />
          <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-[3px] border-l-[3px] border-emerald-300 rounded-bl-lg" />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-[3px] border-r-[3px] border-emerald-300 rounded-br-lg" />
          {/* Soft glow */}
          <div className="absolute inset-0 rounded-lg shadow-[0_0_20px_rgba(52,211,153,0.3),0_0_40px_rgba(52,211,153,0.1)]" />
        </div>
      )}

      {/* Tooltip */}
      <div
        className={`absolute pointer-events-auto transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Connector arrow pointing to the target */}
        {step.position === 'right' && targetRect && (
          <div
            className="absolute -left-2 top-[60px] w-0 h-0 border-t-[6px] border-b-[6px] border-r-[8px] border-t-transparent border-b-transparent border-r-[var(--bg-card)]"
            style={{ filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.3))' }}
          />
        )}

        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-80 shadow-2xl shadow-black/40">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-emerald-400" />
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
                    i === currentStep ? 'w-4 bg-emerald-400' : 'w-1.5 bg-[var(--bg-input)]'
                  }`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-[var(--text-muted)] h-7"
                    onClick={() => {
                      setIsTransitioning(true);
                      setTargetRect(null);
                      setTimeout(() => {
                        setCurrentStep(prev => prev - 1);
                        setIsTransitioning(false);
                      }, 250);
                    }}
                  >
                    Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-[10px] text-[var(--text-muted)] h-7" onClick={skipTour}>
                  Skip
                </Button>
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs" onClick={nextStep}>
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
