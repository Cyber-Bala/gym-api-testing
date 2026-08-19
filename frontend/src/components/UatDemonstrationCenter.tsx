import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface WorkflowStep {
  stepId: string;
  name: string;
  category: string;
  status: 'passed' | 'failed';
  details: string;
  latencyMs: number;
}

interface E2EResult {
  totalFlows: number;
  passedFlows: number;
  failedFlows: number;
  overallStatus: 'passed' | 'failed';
  totalDurationMs: number;
  timestamp: string;
  flows: WorkflowStep[];
}

export const UatDemonstrationCenter: React.FC = () => {
  const { user, devLogin } = useAuth();
  const toast = useToast();
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<E2EResult | null>(null);

  const personas = [
    {
      role: 'Hosteller',
      email: 'hosteller@rajalakshmi.edu.in',
      name: 'Karthik Raja',
      desc: 'Free instantaneous bookings.',
    },
    {
      role: 'Day Scholar',
      email: 'dayscholar@rajalakshmi.edu.in',
      name: 'Priya Sharma',
      desc: 'Requires active pass before booking.',
    },
    {
      role: 'Trainer',
      email: 'trainer@rajalakshmi.edu.in',
      name: 'Vignesh K',
      desc: 'Shifts, floor monitor, overstayers.',
    },
    {
      role: 'Admin',
      email: 'admin@rajalakshmi.edu.in',
      name: 'Gym Admin',
      desc: 'Executive control, audit logs, reports.',
    },
    {
      role: 'Super Admin',
      email: 'iiic@rajalakshmi.edu.in',
      name: 'IIIC Super Admin',
      desc: 'Institutional oversight, admin provisioning & cold storage.',
    },
  ];

  const handleRunAllFlows = async () => {
    setRunning(true);
    try {
      const data = await api.post<E2EResult>('/api/v1/integration/run-all-flows', {});
      setResult(data);
      if (data.overallStatus === 'passed') {
        toast.success(`All ${data.passedFlows} E2E flows passed successfully in ${data.totalDurationMs}ms!`);
      } else {
        toast.error(`E2E Suite completed with ${data.failedFlows} failure(s).`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'E2E Suite Execution Failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Solid surface, zero gradients) */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5">
              <Badge tone="accent">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Sprint 17 Production Release Candidate
              </Badge>
            </div>
            <h3 className="font-bold text-lg sm:text-xl text-text">
              End-to-End System Integration & Stakeholder UAT Console
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Demonstrate all 12 operational user flows across the full lifecycle: Student Ingestion, Membership Gating, 3-Day Rolling Window, Concurrency Locking, Turnstile Biometrics, APB, Overstayers, No-Show Penalties, Payroll, and Cold Storage.
            </p>
          </div>

          <Button
            variant="accent"
            size="md"
            onClick={handleRunAllFlows}
            loading={running}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Run All 12 E2E Flows</span>
          </Button>
        </div>

        {/* Stakeholder Persona Switcher */}
        <div className="pt-4 border-t border-border space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Stakeholder Persona Quick-Switch:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {personas.map((p) => {
              const isCurrent = user?.email === p.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => devLogin(p.email)}
                  className={cn(
                    'p-3 rounded-2xl text-left transition-colors flex flex-col justify-between space-y-1.5 border',
                    isCurrent
                      ? 'bg-primary-muted/20 border-primary shadow-sm text-text'
                      : 'bg-surface border-border hover:bg-border-subtle/40 text-secondary'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-text">{p.name}</span>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] text-accent font-semibold uppercase">{p.role}</span>
                  </div>
                  <p className="text-[10px] text-muted leading-tight line-clamp-2">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* E2E Simulation Result Display */}
      {result && (
        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h4 className="font-bold text-base text-text">
                Integration Verification Results ({result.passedFlows}/{result.totalFlows} Passed • {result.totalDurationMs}ms)
              </h4>
            </div>
            <Badge tone="success">Release Candidate Verified</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.flows.map((f) => (
              <div
                key={f.stepId}
                className="p-4 rounded-2xl border border-border bg-border-subtle/30 flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-xl bg-success-muted/30 text-success flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-primary">
                      {f.stepId}
                    </span>
                    <span className="font-bold text-xs text-text">{f.name}</span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">{f.details}</p>
                  <span className="text-[10px] text-muted font-mono">
                    Category: {f.category} • Latency: {f.latencyMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

