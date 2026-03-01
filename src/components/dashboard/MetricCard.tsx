'use client';

import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  aiGenerated?: boolean;
}

export default function MetricCard({ label, value, subValue, trend, aiGenerated }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl border border-ws-border p-4 relative"
    >
      {aiGenerated && (
        <span className="absolute top-2 right-2 text-[9px] text-ws-text-tertiary bg-ws-bg px-1.5 py-0.5 rounded">
          AI generated
        </span>
      )}
      <p className="text-xs text-ws-text-secondary mb-1">{label}</p>
      <p className="text-xl font-light text-ws-text tracking-tight">{value}</p>
      {subValue && (
        <p
          className={`text-xs mt-0.5 ${
            trend === 'up'
              ? 'text-ws-green'
              : trend === 'down'
                ? 'text-ws-red'
                : 'text-ws-text-tertiary'
          }`}
        >
          {subValue}
        </p>
      )}
    </motion.div>
  );
}
