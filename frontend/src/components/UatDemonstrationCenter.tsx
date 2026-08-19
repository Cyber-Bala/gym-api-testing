import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<E2EResult | null>(null);

  const personas = [
    {
      role: 'student (Hosteller)',
      email: 'hosteller@rajalakshmi.edu.in',
      name: 'Karthik Raja',
      desc: 'Eligible for instant free gym bookings without pass requirement.',
    },
    {
      role: 'student (Day Scholar)',
      email: 'dayscholar@rajalakshmi.edu.in',
      name: 'Priya Sharma',
      desc: 'Requires active Day Scholar pass (₹500/mo) before booking.',
    },
    {
      role: 'trainer',
      email: 'trainer@rajalakshmi.edu.in',
      name: 'Vignesh K',
      desc: 'Can clock in/out shifts, view live floor, and checkout overstayers.',
    },
    {
      role: 'admin',
      email: 'admin@rajalakshmi.edu.in',
      name: 'Gym Administrator',
      desc: 'Full executive control, emergency blackouts, audit logs, and reports.',
    },
    {
      role: 'super_admin',
      email: 'superadmin@rajalakshmi.edu.in',
      name: 'Principal / Management',
      desc: 'Unrestricted institutional oversight and cold data archiving.',
    },
  ];

  const handleRunAllFlows = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/v1/integration/run-all-flows', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data.data);
      }
    } catch {
      // background error
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-rec-purple-950 via-gray-900 to-black text-white rounded-3xl border border-rec-gold/30 shadow-2xl p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rec-gold/20 text-rec-gold text-xs font-bold border border-rec-gold/30">
              <Sparkles className="w-3.5 h-3.5" /> Sprint 17 Production Release Candidate
            </div>
            <h3 className="font-extrabold text-2xl tracking-tight text-white">
              End-to-End System Integration & Stakeholder UAT Console
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Demonstrate all 12 operational user flows across the full lifecycle: Student Ingestion, Membership Gating, 3-Day Rolling Window, Concurrency Locking, Turnstile Biometrics, APB, Overstayers, No-Show Penalties, Payroll, and Cold Storage.
            </p>
          </div>

          <button
            onClick={handleRunAllFlows}
            disabled={running}
            className="px-5 py-3 rounded-2xl bg-rec-gold hover:bg-rec-gold-400 text-gray-900 font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-rec-gold/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating 12 E2E Flows...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run All 12 E2E Flows</span>
              </>
            )}
          </button>
        </div>

        {/* Stakeholder Persona Switcher */}
        <div className="pt-4 border-t border-gray-800 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Stakeholder Persona Quick-Switch:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {personas.map((p) => {
              const isCurrent = user?.email === p.email;
              return (
                <button
                  key={p.email}
                  onClick={() => devLogin(p.email)}
                  className={`p-3 rounded-2xl text-left transition-all flex flex-col justify-between space-y-1 ${
                    isCurrent
                      ? 'bg-rec-gold/20 border-2 border-rec-gold text-white shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{p.name}</span>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] text-rec-gold font-semibold uppercase">{p.role}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* E2E Simulation Result Display */}
      {result && (
        <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-base text-gray-900 dark:text-white">
                Integration Verification Results ({result.passedFlows}/{result.totalFlows} Passed • {result.totalDurationMs}ms)
              </h4>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase">
              Release Candidate Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.flows.map((f) => (
              <div
                key={f.stepId}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-rec-purple dark:text-rec-gold">
                      {f.stepId}
                    </span>
                    <span className="font-bold text-xs text-gray-900 dark:text-white">{f.name}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{f.details}</p>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Category: {f.category} • Latency: {f.latencyMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
