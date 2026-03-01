'use client';

import { Briefcase, Wallet, Target, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const CATEGORIES = [
  {
    icon: <Briefcase size={20} />,
    title: 'Employment & Income',
    desc: 'Salary, pay frequency',
    colour: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <Wallet size={20} />,
    title: 'Personal Finances',
    desc: 'Expenses, savings rate',
    colour: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <Target size={20} />,
    title: 'Investment Goals',
    desc: 'Retirement, income target',
    colour: 'bg-amber-50 text-amber-600',
  },
  {
    icon: <Shield size={20} />,
    title: 'Risk Profile',
    desc: 'Portfolio, assumptions',
    colour: 'bg-purple-50 text-purple-600',
  },
];

interface ReviewWelcomeProps {
  onStart: () => void;
}

export default function ReviewWelcome({ onStart }: ReviewWelcomeProps) {
  return (
    <div className="max-w-lg mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-serif text-3xl text-ws-text mb-3 tracking-tight">
          Hello Alex, let's make sure your financial picture is up to date
        </h1>
        <p className="text-sm text-ws-text-secondary mb-8">
          We'll walk through a few categories to confirm your info. This should take about 3 minutes.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {CATEGORIES.map((cat, i) => (
          <motion.div
            key={cat.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
            className="bg-white rounded-xl border border-ws-border p-4 text-left"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${cat.colour}`}>
              {cat.icon}
            </div>
            <p className="text-sm font-medium text-ws-text">{cat.title}</p>
            <p className="text-xs text-ws-text-tertiary mt-0.5">{cat.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <button
          onClick={onStart}
          className="w-full bg-ws-dark text-white rounded-full py-3 text-sm font-medium hover:bg-ws-black transition-colors"
        >
          Get started
        </button>
        <Link
          href="/simulator"
          className="block text-sm text-ws-text-tertiary hover:text-ws-text-secondary transition-colors"
        >
          Skip for now
        </Link>
      </motion.div>
    </div>
  );
}
