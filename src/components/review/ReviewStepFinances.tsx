'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles, X } from 'lucide-react';
import { useProfileStore } from '@/lib/store/profile-store';
import { deriveMonthlyExpenses } from '@/lib/analysis/expense-detection';
import { calculateIncomeTax } from '@/lib/simulation/canadian-tax';
import ReviewConfirmField from './ReviewConfirmField';

interface CustomExpense {
  id: string;
  label: string;
  amount: number;
}

interface ReviewStepFinancesProps {
  onNext: () => void;
  onBack: () => void;
}

export default function ReviewStepFinances({ onNext, onBack }: ReviewStepFinancesProps) {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);
  const getBankingAccounts = useProfileStore((s) => s.getBankingAccounts);

  const [customExpenses, setCustomExpenses] = useState<CustomExpense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const expenseInsight = useMemo(() => {
    const banking = getBankingAccounts();
    const chequing = banking.find((a) => a.type === 'chequing');
    const creditCard = banking.find((a) => a.type === 'credit-card');
    const chequingTxns = chequing?.transactions || [];
    const ccTxns = creditCard?.transactions || [];
    if (chequingTxns.length === 0 && ccTxns.length === 0) return null;
    return deriveMonthlyExpenses(chequingTxns, ccTxns);
  }, [getBankingAccounts]);

  // Sort detected categories: "other" always last
  const sortedCategories = useMemo(() => {
    if (!expenseInsight) return [];
    const cats = [...expenseInsight.byCategory];
    cats.sort((a, b) => {
      if (a.category === 'other') return 1;
      if (b.category === 'other') return -1;
      return b.monthlyAmount - a.monthlyAmount;
    });
    return cats.slice(0, 6);
  }, [expenseInsight]);

  const handleAddExpense = useCallback(() => {
    const amount = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amount) || amount <= 0) return;
    const expense: CustomExpense = {
      id: `custom-${Date.now()}`,
      label: newLabel.trim(),
      amount: Math.round(amount),
    };
    setCustomExpenses((prev) => [...prev, expense]);
    setNewLabel('');
    setNewAmount('');
    setIsAdding(false);
  }, [newLabel, newAmount]);

  const handleRemoveExpense = useCallback((id: string) => {
    setCustomExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Update monthlyExpenses when custom expenses change
  useEffect(() => {
    const detected = expenseInsight?.estimatedMonthlyExpenses ?? 0;
    const custom = customExpenses.reduce((sum, e) => sum + e.amount, 0);
    updateField('monthlyExpenses', detected + custom);
  }, [customExpenses, expenseInsight, updateField]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto"
    >
      <h2 className="font-serif text-2xl text-ws-text mb-1">Personal Finances</h2>
      <p className="text-sm text-ws-text-secondary mb-6">
        Review the numbers below. Edit anything that needs updating, then confirm & continue.
      </p>

      {expenseInsight && (
        <div className="bg-ws-green-light rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <Sparkles size={16} className="text-ws-green mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-ws-text">
                Estimated ~${expenseInsight.estimatedMonthlyExpenses.toLocaleString()}/mo from your transactions
              </p>
              <p className="text-xs text-ws-text-secondary mt-0.5">
                {expenseInsight.explanation}
              </p>
            </div>
          </div>

          {sortedCategories.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {sortedCategories.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-xs px-2 py-1 bg-white/60 rounded-lg">
                  <span className="text-ws-text-secondary">{cat.label}</span>
                  <span className="font-medium text-ws-text">${cat.monthlyAmount.toLocaleString()}/mo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-ws-border p-4 mb-4">
        <p className="text-xs text-ws-text-tertiary uppercase tracking-wider mb-2">Additional Expenses</p>

        {customExpenses.length > 0 && (
          <div className="space-y-2 mb-3">
            {customExpenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between text-sm">
                <span className="text-ws-text">{exp.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ws-text">${exp.amount.toLocaleString()}/mo</span>
                  <button onClick={() => handleRemoveExpense(exp.id)} className="text-ws-text-tertiary hover:text-ws-text transition-colors">
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {isAdding ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Rent"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddExpense(); if (e.key === 'Escape') setIsAdding(false); }}
              className="flex-1 text-sm border border-ws-border rounded-lg px-3 py-1.5 bg-white text-ws-text focus:outline-none focus:ring-2 focus:ring-ws-green/30"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-ws-text-secondary">$</span>
              <input
                type="number"
                placeholder="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddExpense(); if (e.key === 'Escape') setIsAdding(false); }}
                className="w-24 text-sm border border-ws-border rounded-lg px-3 py-1.5 bg-white text-ws-text focus:outline-none focus:ring-2 focus:ring-ws-green/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-sm text-ws-text-secondary">/mo</span>
            </div>
            <button
              onClick={handleAddExpense}
              className="p-1.5 rounded-lg bg-ws-green text-white hover:bg-ws-green/90 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-sm text-ws-text-tertiary hover:text-ws-green transition-colors"
          >
            <Plus size={14} />
            Add expense
          </button>
        )}
      </div>

      <div className="space-y-3">
        <ReviewConfirmField
          label="Age"
          value={String(profile.age)}
          editValue={profile.age}
          min={18}
          max={80}
          onChange={(v) => updateField('age', Math.round(v as number))}
        />

        <ReviewConfirmField
          label="Monthly Expenses"
          value={`$${profile.monthlyExpenses.toLocaleString()}/mo`}
          editValue={profile.monthlyExpenses}
          prefix="$"
          suffix="/mo"
          min={0}
          max={50000}
          step={100}
          insight={expenseInsight ? 'Derived from your transaction history' : undefined}
          onChange={(v) => updateField('monthlyExpenses', Math.round(v as number))}
        />

        {(() => {
          const tax = calculateIncomeTax(profile.annualIncome, profile.province);
          const netAnnual = profile.annualIncome - tax;
          const savingsAnnual = Math.round(netAnnual * profile.annualSavingsRate);
          const savingsMonthly = Math.round(savingsAnnual / 12);
          return (
            <div className="bg-white rounded-xl border border-ws-border p-4">
              <p className="text-xs text-ws-text-tertiary uppercase tracking-wider mb-1">Savings Rate</p>
              <p className="text-lg font-semibold text-ws-text">{(profile.annualSavingsRate * 100).toFixed(0)}%</p>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={Math.round(profile.annualSavingsRate * 100)}
                onChange={(e) => updateField('annualSavingsRate', parseInt(e.target.value) / 100)}
                className="w-full h-1.5 mt-2 mb-1 rounded-full appearance-none cursor-pointer bg-gray-200 accent-ws-green [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ws-green [&::-webkit-slider-thumb]:shadow-sm"
              />
              <p className="text-xs text-ws-text-secondary mt-1">
                ${savingsMonthly.toLocaleString()}/mo · ${savingsAnnual.toLocaleString()}/yr of ${Math.round(netAnnual).toLocaleString()} net income
              </p>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-sm text-ws-text-secondary hover:text-ws-text transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="bg-ws-dark text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-ws-black transition-colors"
        >
          Confirm & continue
        </button>
      </div>
    </motion.div>
  );
}
