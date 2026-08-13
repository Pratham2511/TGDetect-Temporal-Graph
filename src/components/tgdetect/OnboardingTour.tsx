'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, Upload, UserCircle,
  ChevronRight, ChevronLeft, X,
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
    position: 'center',
    icon: Shield,
  },
  {
    targetId: 'nav-dashboard',
    title: 'Dashboard Overview',
    description: 'Get a real-time view of your detection pipeline. Monitor live event ingestion, threat metrics, network traffic patterns, and recent detection alerts — all powered by the V16 Apex TGNN model.',
    position: 'right',
    icon: LayoutDashboard,
  },
  {
    targetId: 'nav-analytics',
    title: 'Deep Analytics',
    description: 'Dive deep into detection analytics across DARPA TC, UNSW-NB15, and LANL NetFlow sources. View per-source metrics, fused temporal graph analysis, concept drift adaptation, attack backtracking, and explainability.',
    position: 'right',
    icon: BarChart3,
  },
  {
    targetId: 'nav-datasets',
    title: 'Dataset Management',
    description: 'Upload your network logs in 12+ formats including CSV, JSON, Syslog, NetFlow, Zeek, and Suricata EVE. Our smart column mapper auto-detects your schema.',
    position: 'right',
    icon: Upload,
  },
  {
    targetId: 'nav-profiles',
    title: 'Analysis Profiles',
    description: 'Create dedicated profiles for different datasets and investigations. Each profile maintains its own V16 Apex configuration.',
    position: 'right',
    icon: UserCircle,
  },
  {
    targetId: 'live-metrics',
    title: 'Live System Monitoring',
    description: 'The system pulse bar shows real-time ingestion metrics: events per second, active nodes, graph edges, and memory usage — updated live from the synthetic stream.',
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

const PADDING = 10;

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const rafRef = useRef<number>(0);

  const step = TOUR_STEPS[currentStep];

  // Theme detection via DOM
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const overlayFill = isDark ? 'rgba(2, 12, 27, 0.72)' : 'rgba(7, 22, 40, 0.65)';
  const highlightBorder = isDark ? 'rgba(96, 165, 250, 0.8)' : 'rgba(37, 99, 235, 0.7)';
  const highlightGlow = isDark
    ? '0 0 0 1px rgba(96, 165, 250, 0.3), 0 0 16px rgba(96, 165, 250, 0.15), 0 0 40px rgba(96, 165, 250, 0.08)'
    : '0 0 0 1px rgba(37, 99, 235, 0.2), 0 0 12px rgba(37, 99, 235, 0.1)';
  const highlightBg = isDark ? 'rgba(96, 165, 250, 0.04)' : 'rgba(37, 99, 235, 0.03)';
  const cornerColor = isDark ? 'rgb(147, 197, 253)' : 'rgb(59, 130, 246)';
  const accentColor = isDark ? 'rgb(96, 165, 250)' : 'rgb(37, 99, 235)';
  const accentBg = isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)';

  // F3 — computeSpotlight with scroll + requestAnimationFrame
  const computeSpotlight = useCallback((stepIndex: number) => {
    const s = TOUR_STEPS[stepIndex];
    if (!s) return;
    const el = document.getElementById(s.targetId);
    if (!el) {
      setTargetRect({ top: window.innerHeight / 2 - 50, left: window.innerWidth / 2 - 150, width: 300, height: 100 });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    setTimeout(() => {
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const newRect: TargetRect = {
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        };
        setTargetRect(newRect);

        // Position tooltip
        let tooltipTop = 0;
        let tooltipLeft = 0;

        if (s.position === 'right') {
          tooltipTop = rect.top + rect.height / 2 - 60;
          tooltipLeft = rect.right + PADDING + 16;
        } else if (s.position === 'bottom') {
          tooltipTop = rect.bottom + PADDING + 16;
          tooltipLeft = rect.left + rect.width / 2 - 160;
        } else if (s.position === 'left') {
          tooltipTop = rect.top + rect.height / 2 - 60;
          tooltipLeft = rect.left - PADDING - 336;
        }

        tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - 340));
        tooltipTop = Math.max(12, Math.min(tooltipTop, window.innerHeight - 200));

        setTooltipPos({ top: tooltipTop, left: tooltipLeft });
      });
    }, 400);
  }, []);

  // Initial measurement
  useEffect(() => {
    if (step.position !== 'center') {
      computeSpotlight(currentStep);
    }
    window.addEventListener('resize', () => computeSpotlight(currentStep));
    return () => {
      window.removeEventListener('resize', () => computeSpotlight(currentStep));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, computeSpotlight]);

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

  // F1/F2 — Center modal (welcome step)
  if (step.position === 'center') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: overlayFill, backdropFilter: 'blur(2px)' }}>
        <div className={`rounded-2xl w-full max-w-lg shadow-2xl mx-4 transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        >
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'hsl(var(--foreground))' }}>{step.title}</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>{step.description}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-8' : 'w-2'
                }`} style={{ backgroundColor: i === currentStep ? accentColor : 'hsl(var(--secondary))' }} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" style={{ color: 'hsl(var(--muted-foreground))' }} onClick={skipTour}>
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

  // F1/F3 — Spotlight steps with SVG mask overlay
  return (
    <div className="fixed inset-0 z-[100]">
      {/* SVG Overlay with cutout hole — F1: 72% opacity */}
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
          fill={overlayFill}
          mask="url(#tour-spotlight)"
          style={{ backdropFilter: 'blur(1px)' }}
        />
      </svg>

      {/* Highlight ring around the target */}
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

      {/* F2 — Tooltip with CSS variable styling */}
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

        <div
          className="rounded-xl w-80"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--primary) / 0.4)',
            color: 'hsl(var(--foreground))',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border))',
          }}
        >
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
                  <h3 className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{step.title}</h3>
                  <Badge
                    style={{
                      fontSize: '9px',
                      background: 'hsl(var(--secondary))',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border-light))',
                    }}
                    className="mt-0.5"
                  >
                    {currentStep + 1} / {TOUR_STEPS.length}
                  </Badge>
                </div>
              </div>
              <button
                onClick={skipTour}
                style={{ color: 'hsl(var(--muted-foreground))' }}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>{step.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-4' : 'w-1.5'
                  }`} style={{ backgroundColor: i === currentStep ? accentColor : 'hsl(var(--secondary))' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-7 gap-0.5"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                    onClick={() => goToStep(-1)}
                  >
                    <ChevronLeft className="w-3 h-3" /> Back
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-[10px] h-7" style={{ color: 'hsl(var(--muted-foreground))' }} onClick={skipTour}>
                  Skip
                </Button>
                <Button
                  size="sm"
                  className="text-white h-7 text-xs"
                  style={{ backgroundColor: accentColor }}
                  onClick={() => goToStep(1)}
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animation */}
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
