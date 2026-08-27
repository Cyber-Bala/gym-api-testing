import React from 'react';
import { cn } from '../lib/cn';

/** Apple Face ID mark: rounded scan frame with a face. */
export const FaceIdIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
    aria-hidden
  >
    <path
      d="M8 3H6.5A3.5 3.5 0 0 0 3 6.5V8"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M16 3h1.5A3.5 3.5 0 0 1 21 6.5V8"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M8 21H6.5A3.5 3.5 0 0 1 3 17.5V16"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M16 21h1.5A3.5 3.5 0 0 0 21 17.5V16"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="9.25" cy="10.25" r="1.15" fill="currentColor" />
    <circle cx="14.75" cy="10.25" r="1.15" fill="currentColor" />
    <path
      d="M12 11.25v1.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M9.4 14.6c.7 1.15 1.6 1.7 2.6 1.7s1.9-.55 2.6-1.7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
