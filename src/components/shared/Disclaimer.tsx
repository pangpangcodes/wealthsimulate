'use client';

import { AlertTriangle } from 'lucide-react';

export default function Disclaimer() {
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-ws-yellow-light border border-ws-yellow/20 rounded-xl text-xs text-ws-text-secondary">
      <AlertTriangle size={14} className="text-ws-yellow flex-shrink-0 mt-0.5" />
      <p>
        <strong className="text-ws-text">Not financial advice.</strong> We simulate 1,000 possible
        futures using historical market patterns and simplified Canadian tax rules. Real results will
        vary.
      </p>
    </div>
  );
}
