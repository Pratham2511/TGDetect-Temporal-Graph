'use client';
import { useState, useEffect, useCallback } from 'react';
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
    description: 'Get a real-time view of your detection pipeline. Monitor live event ingestion, threat metrics, network traffic patterns, and recent detection alerts \u2014 all powered by the V16 Apex TGNN model.',
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
    description: 'Create dedicated profiles for different datasets and investigations. Each profile maintains its own V16 Apex configuration \u2014 temporal window, memory dimensions, attention heads, and detection thresholds.',
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

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const step = TOUR_STEPS[currentStep];

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 200);
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
        setTimeout(() => {
          setCurrentStep(prev => prev - 1);
          setIsTransitioning(false);
        }, 200);
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

  // For other steps, show spotlight-style tooltip
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto" onClick={skipTour} />
      
      {/* Tooltip */}
      <div className={`absolute ${getPositionClasses(step.position, step.targetId)} pointer-events-auto transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl w-80 shadow-2xl">
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

function getPositionClasses(position: string, targetId: string): string {
  switch (position) {
    case 'right':
      return 'top-1/3 left-[300px]';
    case 'bottom':
      return 'top-[200px] left-1/2 -translate-x-1/2';
    default:
      return 'top-1/2 left-1/2 -translate-x-1/2';
  }
}
