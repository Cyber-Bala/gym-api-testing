import React from 'react';
import { cn } from '../lib/cn';

interface RecLogoProps {
  className?: string;
  alt?: string;
}

export const RecLogo: React.FC<RecLogoProps> = ({
  className,
  alt = 'REC Logo',
}) => (
  <img
    src="/images/rec_logo.png"
    alt={alt}
    className={cn('object-contain', className)}
  />
);
