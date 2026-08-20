import React, { useState, useEffect } from 'react';
import { UserRound, CheckCircle2 } from 'lucide-react';
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
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (details) {
      if (details.phone) setPhone(details.phone);
      if (details.emergencyContact) setEmergencyContact(details.emergencyContact);
      if (details.address) setAddress(details.address);
      if (details.healthConcerns) setHealthConcerns(details.healthConcerns);
    }
  }, [details]);

  const incomplete = (!details?.phone || !details?.emergencyContact) && !justSaved;
  if (!incomplete) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/api/v1/people/students/me', {
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim(),
        address: address.trim(),
        healthConcerns: healthConcerns.trim(),
      });
      setJustSaved(true);
      toast.success('Your profile details have been saved successfully!');
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 border-accent/30 bg-surface-elevated/80 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-muted text-primary">
            <UserRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-text">Complete Your Profile</h3>
            <p className="text-xs text-secondary">
              Please provide your emergency contact & phone number for gym safety & access compliance
            </p>
          </div>
        </div>
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
          label="Address (Hostel / Residence)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Hostel block, room no / home address"
        />

        <Textarea
          label="Health Concerns & Medical Conditions"
          value={healthConcerns}
          onChange={(e) => setHealthConcerns(e.target.value)}
          placeholder="e.g. Asthma, cardiac history, knee injury — leave empty if none"
        />

        <div className="flex justify-end pt-1">
          <Button variant="primary" size="md" loading={saving} type="submit">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span>Save & Complete Profile</span>
          </Button>
        </div>
      </form>
    </Card>
  );
};