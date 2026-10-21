import React from 'react';
import { Modal } from './primitives';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    title={title}
    onClose={loading ? () => undefined : onCancel}
    footer={
      <>
        <Button variant="outline" size="md" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone} size="md" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-secondary">{message}</div>
  </Modal>
);
