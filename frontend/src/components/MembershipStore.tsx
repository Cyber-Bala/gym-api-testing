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

      // 2. Verify payment (Razorpay / Instant Checkout Simulation)
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
    <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Day Scholar Gym Membership Store
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Razorpay Institutional Gateway • Multi-Tier Passes (1M / 3M / 1Y) • Free for Hostellers
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
          title="Refresh plans"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Active Membership Status Card */}
      {myMembership ? (
        <div className="p-6 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300">
                Active Membership Pass
              </span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              {myMembership.daysRemaining} Days Remaining
            </span>
          </div>

          <h4 className="font-bold text-lg text-gray-900 dark:text-white mt-1">
            {myMembership.planName} (₹{myMembership.price})
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Valid until {new Date(myMembership.endDate).toLocaleDateString()} • Full access to 10 daily slot batches & turnstile entry.
          </p>
        </div>
      ) : isDayScholar ? (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">No Active Membership Pass Found</p>
            <p className="mt-0.5 text-xs opacity-90">
              As a Day Scholar, please activate a 1-Month, 3-Month, or 1-Year pass below to enable slot reservations and turnstile access.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-xs flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-rec-purple dark:text-rec-gold shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-gray-900 dark:text-white">Hosteller Student Privilege</p>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">
              Hosteller residency includes complimentary gym access. You can book any open slot immediately without purchasing a pass!
            </p>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isFeatured = p.durationDays === 90;
          return (
            <div
              key={p.id}
              className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 transition-all ${
                isFeatured
                  ? 'border-rec-purple dark:border-rec-gold bg-rec-purple-50/20 dark:bg-rec-purple-950/20 shadow-md relative'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#202024]/50'
              }`}
            >
              {isFeatured && (
                <span className="absolute -top-2.5 right-4 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rec-purple text-white">
                  Most Popular
                </span>
              )}

              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-base text-gray-900 dark:text-white">{p.name}</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{p.durationDays} Days Duration</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">₹{p.price}</span>
                  <span className="text-xs text-gray-500 font-medium">/ session package</span>
                </div>

                <ul className="space-y-2 pt-2 text-xs text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>10 Daily Workout Slots Access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ZKBio Face Turnstile Check-In</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Free Locker Room & Showers</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handlePurchase(p)}
                disabled={purchasingPlanId === p.id}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all shadow-md ${
                  isFeatured
                    ? 'bg-rec-purple hover:bg-rec-purple-600 text-white shadow-rec-purple/20'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90'
                }`}
              >
                {purchasingPlanId === p.id
                  ? 'Processing Razorpay...'
                  : myMembership?.isActive
                  ? 'Extend Pass'
                  : 'Activate Pass Now'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
