import React, { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Card } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const StudentOnboardingCard: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const details = user?.studentDetails;

  const [phone, setPhone] = useState(details?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState(details?.emergencyContact || '');
  const [address, setAddress] = useState(details?.address || '');
  const [healthConcerns, setHealthConcerns] = useState(details?.healthConcerns || '');
  const [saving, setSaving] = useState(false);

  const incomplete = !details?.phone || !details?.emergencyContact;
  if (!incomplete) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/api/v1/people/students/me', {
        phone,
        emergencyContact,
        address,
        healthConcerns,
      });
      toast.success('Profile saved');
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <UserRound className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-sm sm:text-base text-text">Complete Your Profile</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Contact Number"
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <Input
            label="Emergency Contact Number"
            required
            type="tel"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            placeholder="+91 98765 00000"
          />
        </div>

        <Textarea
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Hostel block, room no / home address"
        />

        <Textarea
          label="Health Concerns"
          value={healthConcerns}
          onChange={(e) => setHealthConcerns(e.target.value)}
          placeholder="e.g. Asthma, knee injury — leave empty if none"
        />

        <Button variant="primary" size="md" loading={saving} type="submit">
          Save Profile
        </Button>
      </form>
    </Card>
  );
};