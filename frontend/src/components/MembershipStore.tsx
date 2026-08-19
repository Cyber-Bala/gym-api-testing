import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { cn } from '../lib/cn';

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

export const MembershipStore: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [myMembership, setMyMembership] = useState<UserMembership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDayScholar = user?.studentDetails?.residency === 'day_scholar';

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch plans
      const plansRes = await fetch('/api/v1/membership/plans');
      const plansData = await plansRes.json();
      if (plansRes.ok) {
        setPlans(plansData.data || []);
      }

      // 2. Fetch my membership
      if (user && user.studentDetails) {
        const memRes = await fetch('/api/v1/membership/my-membership', {
          credentials: 'include',
        });
        const memData = await memRes.json();
        if (memRes.ok && memData.data) {
          setMyMembership(memData.data.activeMembership);
        }
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handlePurchase = async (plan: MembershipPlan) => {
    if (!user) {
      alert('Please log in with your student account');
      return;
    }

    setPurchasingPlanId(plan.id);
    setSuccessMessage(null);

    try {
      // 1. Create order
      const orderRes = await fetch('/api/v1/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
        credentials: 'include',
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error?.message || 'Failed to create payment order');

      const { orderId } = orderData.data;

      // 2. Verify payment (Razorpay Simulation)
      const verifyRes = await fetch('/api/v1/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentId: `pay_${Date.now()}`,
          signature: 'simulated_success',
        }),
        credentials: 'include',
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error?.message || 'Payment verification failed');

      setSuccessMessage(`Payment successful! Your ${plan.name} is now active.`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPurchasingPlanId(null);
    }
  };

  return (
    <Card className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base sm:text-lg text-text">
              Day Scholar Gym Membership Store
            </h3>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            Razorpay Gateway • Multi-Tier Passes (1M / 3M / 1Y) • Free for Hostellers
          </p>
        </div>

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
        <div className="p-5 rounded-2xl border border-success/30 bg-success-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" />
              <span className="text-xs uppercase font-bold text-success">
                Active Membership Pass
              </span>
            </div>
            <Badge tone="success">
              {myMembership.daysRemaining} Days Remaining
            </Badge>
          </div>

          <h4 className="font-bold text-lg text-text mt-1">
            {myMembership.planName} (₹{myMembership.price})
          </h4>
          <p className="text-xs text-secondary">
            Valid until {new Date(myMembership.endDate).toLocaleDateString()} • Full access to all 10 daily slot batches & biometric turnstile entry.
          </p>
        </div>
      ) : isDayScholar ? (
        <Alert tone="warning">
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Active Membership Pass Found</p>
              <p className="mt-0.5 text-xs text-secondary">
                As a Day Scholar, please activate a 1-Month, 3-Month, or 1-Year pass below to enable slot reservations and turnstile access.
              </p>
            </div>
          </div>
        </Alert>
      ) : (
        <Alert tone="info">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Hosteller Student Privilege</p>
              <p className="mt-0.5 text-xs text-secondary">
                Hosteller residency includes complimentary gym access. You can book any open slot immediately without purchasing a pass!
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isFeatured = p.durationDays === 90;
          return (
            <div
              key={p.id}
              className={cn(
                'p-6 rounded-2xl border bg-surface flex flex-col justify-between space-y-6 transition-colors',
                isFeatured
                  ? 'border-primary bg-primary-muted/20 relative'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {isFeatured && (
                <div className="absolute -top-2.5 right-4">
                  <Badge tone="primary">Most Popular</Badge>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-base text-text">{p.name}</h4>
                  <p className="text-xs text-muted font-mono mt-0.5">{p.durationDays} Days Duration</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-text">₹{p.price}</span>
                  <span className="text-xs text-muted font-medium">/ package</span>
                </div>

                <ul className="space-y-2 pt-2 text-xs text-secondary">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <span>10 Daily Workout Slots Access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <span>ZKBio Face Turnstile Check-In</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <span>Free Locker Room & Showers</span>
                  </li>
                </ul>
              </div>

              <Button
                variant={isFeatured ? 'primary' : 'secondary'}
                size="md"
                className="w-full"
                loading={purchasingPlanId === p.id}
                onClick={() => handlePurchase(p)}
              >
                {purchasingPlanId === p.id
                  ? 'Processing Razorpay...'
                  : myMembership?.isActive
                  ? 'Extend Pass'
                  : 'Activate Pass Now'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

