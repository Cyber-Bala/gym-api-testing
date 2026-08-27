import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Zap,
  Receipt,
  FileText,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, Badge, Alert, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { MembershipPlanManager } from './MembershipPlanManager';
import { cn } from '../lib/cn';
import { RecLogo } from './RecLogo';
import {
  clearPaymentQueryFromUrl,
  clearPayUCheckoutSession,
  readPaymentQueryResult,
  startPayUCheckout,
} from '../lib/payu';

interface MembershipPlan {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  isActive: string;
}

interface UserMembership {
  id: string;
  planName: string;
  price: string;
  durationDays: number;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
}

interface PaymentRecord {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  planName: string;
  durationDays: number;
  createdAt: string;
}

interface MembershipStoreProps {
  mandatoryMode?: boolean;
}

export const MembershipStore: React.FC<MembershipStoreProps> = ({ mandatoryMode = false }) => {
  const { user, refreshSession, logout } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [myMembership, setMyMembership] = useState<UserMembership | null>(null);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDayScholar = user?.studentDetails?.residency === 'day_scholar';
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);


  // Handle return from PayU (surl/furl redirect → FRONTEND_URL/?payment=…)
  useEffect(() => {
    const result = readPaymentQueryResult();
    if (!result) return;

    clearPaymentQueryFromUrl();
    clearPayUCheckoutSession();

    if (result === 'success') {
      const msg = 'Payment confirmed via PayU. Your gym pass is now active.';
      setSuccessMessage(msg);
      toast.success(msg, 'Payment Verified');
      void refreshSession().then(() => fetchData());
      return;
    }

    if (result === 'cancelled') {
      toast.error('Payment was cancelled or failed on PayU. You can try again.');
      return;
    }

    toast.info(
      'Payment is still pending confirmation. Refresh in a moment if your pass does not activate.'
    );
    void refreshSession().then(() => fetchData());
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch plans
      const plansData = await api.get<MembershipPlan[]>('/api/v1/membership/plans');
      if (Array.isArray(plansData)) {
        setPlans(plansData);
      }

      // 2. Fetch active membership
      if (user && user.studentDetails) {
        const memData = await api.get<{ activeMembership: UserMembership | null }>(
          '/api/v1/membership/my-membership'
        );
        if (memData) {
          setMyMembership(memData.activeMembership);
        }

        // 3. Fetch payment history
        try {
          const histData = await api.get<PaymentRecord[]>('/api/v1/payment/my-history');
          if (Array.isArray(histData)) {
            setHistory(histData);
          }
        } catch {
          // history catch
        }
      }
    } catch (err) {
      // background error catch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (isAdmin) {
    return <MembershipPlanManager />;
  }

  const handlePurchase = async (plan: MembershipPlan) => {
    if (!user) {
      toast.warning('Please sign in with your student account first.');
      return;
    }

    setPurchasingPlanId(plan.id);
    setSuccessMessage(null);

    try {
      const mode = await startPayUCheckout(plan.id);

      if (mode === 'simulated') {
        const msg = `Payment confirmed! Your ${plan.name} pass is now active.`;
        setSuccessMessage(msg);
        toast.success(msg, 'Payment Completed');
        await refreshSession();
        fetchData();
        setPurchasingPlanId(null);
        return;
      }

      // Real PayU: browser navigates away via form POST — leave loading state.
      toast.info('Opening PayU secure checkout…');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Order Initiation Failed');
      setPurchasingPlanId(null);
    }
  };

  if (mandatoryMode) {
    return (
      <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center p-4 sm:p-6 relative">
        <div className="w-full max-w-4xl space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-2">
            <RecLogo alt="REC Gym Logo" className="h-24 w-60 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-foreground">Gym Pass Required</h1>
            <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
              As a Day Scholar, buy an active gym pass first. Personal details and face enrollment come after payment.
            </p>
          </div>

          <Card className="space-y-6 shadow-lg relative overflow-hidden">

            {/* Student Info Strip */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated border border-border text-xs">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text truncate">{user?.name}</span>
                  <Badge tone="primary">Day Scholar</Badge>
                  {user?.studentDetails?.rollNumber && (
                    <span className="font-mono text-muted text-[11px]">
                      ({user.studentDetails.rollNumber})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
              </div>

              <Badge tone="warning" className="shrink-0 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Pass Required
              </Badge>
            </div>

            {successMessage && (
              <Alert tone="success" onDismiss={() => setSuccessMessage(null)}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="font-semibold">{successMessage}</span>
                </div>
              </Alert>
            )}

            {/* Plans Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-text">Choose Your Gym Membership Pass</h4>
                <IconButton
                  label="Refresh plans"
                  size="sm"
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </IconButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 relative bg-surface-elevated/60',
                      'border-border hover:border-primary hover:shadow-md'
                    )}
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-base text-text">{p.name}</h4>
                      <p className="text-xs text-muted">{p.durationDays} Days Access</p>
                      <div className="pt-2 text-2xl font-black text-text">
                        ₹{p.price}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      className="w-full shadow-sm"
                      loading={purchasingPlanId === p.id}
                      onClick={() => handlePurchase(p)}
                    >
                      {purchasingPlanId === p.id ? 'Processing...' : 'Pay & Activate'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
              <span className="text-[11px]">
                Payments are securely processed via PayU.
              </span>

              <button
                type="button"
                onClick={logout}
                className="text-danger hover:underline inline-flex items-center gap-1 text-[11px] font-medium"
              >
                Sign out
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Gym Passes</h1>

          <IconButton
            label="Refresh plans"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>


        {successMessage && (
          <Alert tone="success" onDismiss={() => setSuccessMessage(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          </Alert>
        )}

        {/* Active Membership Status Card */}
        {myMembership ? (
          <div className="p-5 rounded-2xl bg-surface-elevated space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" />
                <span className="text-xs uppercase font-bold text-success">
                  Active Gym Pass
                </span>
              </div>
              <Badge tone="success">
                {myMembership.daysRemaining} Days Left
              </Badge>
            </div>

            <div>
              <h4 className="font-bold text-lg text-text">
                {myMembership.planName} — ₹{myMembership.price}
              </h4>
              <p className="text-xs text-secondary mt-0.5">
                Valid from {new Date(myMembership.startDate).toLocaleDateString()} until {new Date(myMembership.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : isDayScholar ? (
          <div className="space-y-4">
            <Alert tone="warning">
              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">No Active Membership Pass</p>
                  <p className="mt-0.5 text-xs text-secondary">
                    Please select and activate a pass below to enable gym workout slot reservations.
                  </p>
                </div>
              </div>
            </Alert>

            {/* Plans Grid (Only shown when Day Scholar has no active pass) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="p-5 rounded-2xl bg-surface-elevated flex flex-col justify-between space-y-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-text">{p.name}</h4>
                        <p className="text-xs text-muted font-mono mt-0.5">{p.durationDays} Days Duration</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-2xl font-black text-text">₹{p.price}</span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    loading={purchasingPlanId === p.id}
                    onClick={() => handlePurchase(p)}
                  >
                    {purchasingPlanId === p.id ? 'Processing...' : 'Activate Pass'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-surface-elevated space-y-2 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" />
              <span className="text-xs uppercase font-bold text-success">
                Hosteller Gym Access
              </span>
            </div>
            <h4 className="font-bold text-base text-text">Inclusive Campus Residency Pass</h4>
            <p className="text-xs text-secondary">
              Gym membership is fully covered by college hostel residency with zero subscription charges.
            </p>
          </div>
        )}
      </Card>


      {/* Payment Receipts & Transaction Ledger */}
      {user && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-sm text-text">Payment Transactions & Receipts</h4>
            </div>
            <span className="text-xs text-muted font-mono">{history.length} records</span>
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="No transactions found"
              description="Your membership payment history and PayU transaction IDs will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted font-medium">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Payment ID</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-border-subtle/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-muted">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-text">{h.planName}</td>
                      <td className="py-2.5 px-3 font-mono text-secondary text-[11px]">{h.orderId}</td>
                      <td className="py-2.5 px-3 font-mono text-primary text-[11px]">
                        {h.paymentId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-text">₹{h.amount}</td>
                      <td className="py-2.5 px-3">
                        <Badge tone={h.status === 'paid' ? 'success' : 'warning'}>
                          {h.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
