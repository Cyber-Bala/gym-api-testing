import React from 'react';

export const AppFooter: React.FC = () => (
  <div className="flex flex-col items-center justify-center w-full h-20 relative">
    <p className="font-medium text-foreground/70 flex items-center gap-1">
      Made with
      <span className="text-red-500 animate-pulse px-0.5" aria-hidden>
        ♥
      </span>
      by Devs Rec
    </p>
  </div>
);
