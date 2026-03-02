'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '@/lib/store/profile-store';
import type { AssetClass } from '@/lib/types';

interface ParsedAccount {
  name: string;
  type: 'rrsp' | 'tfsa' | 'fhsa' | 'non-registered' | 'resp';
  marketValue: number;
  holdings: {
    ticker: string;
    name: string;
    marketValue: number;
    assetClass: AssetClass;
    currency: 'CAD' | 'USD';
  }[];
}

interface ParsedData {
  accounts: ParsedAccount[];
  totalValue: number;
  statementDate?: string;
  parseConfidence?: 'high' | 'medium' | 'low';
  warnings?: string[];
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface StatementUploadProps {
  onComplete: () => void;
  onCancel: () => void;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  rrsp: 'RRSP',
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  'non-registered': 'Non-Registered',
  resp: 'RESP',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function StatementUpload({ onComplete, onCancel }: StatementUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadFromStatement, setOnboarded } = useProfileStore();

  const handleFile = useCallback(async (file: File) => {
    const isPdf = file.type.includes('pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setErrorMessage('Please upload a PDF or image file.');
      setState('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File is too large (max 10MB).');
      setState('error');
      return;
    }

    setState('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/parse-statement', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse statement');
      }

      setParsedData(result.data);
      setState('success');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Try again or use example data.'
      );
      setState('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleConfirm = () => {
    if (parsedData) {
      loadFromStatement(parsedData);
      setOnboarded(true);
      onComplete();
    }
  };

  const handleReset = () => {
    setState('idle');
    setParsedData(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg mx-auto"
    >
      <AnimatePresence mode="wait">
        {/* Upload zone */}
        {state === 'idle' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
                transition-all duration-200
                ${isDragOver
                  ? 'border-ws-green bg-ws-green-light'
                  : 'border-ws-border bg-white hover:border-ws-text-tertiary hover:bg-ws-hover'
                }
              `}
            >
              <Upload
                size={32}
                className={`mx-auto mb-4 ${isDragOver ? 'text-ws-green' : 'text-ws-text-tertiary'}`}
              />
              <p className="text-sm font-medium text-ws-text mb-1">
                Drop your Wealthsimple export here
              </p>
              <p className="text-xs text-ws-text-tertiary">
                PDF or screenshot - up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="mt-4 w-full text-sm text-ws-text-tertiary hover:text-ws-text-secondary transition-colours"
            >
              or use example data instead
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {state === 'uploading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl border border-ws-border p-12 text-center"
          >
            <Loader2 size={32} className="mx-auto mb-4 text-ws-green animate-spin" />
            <p className="text-sm font-medium text-ws-text mb-1">
              Connecting your account...
            </p>
            <p className="text-xs text-ws-text-tertiary">
              Syncing your portfolio data
            </p>
          </motion.div>
        )}

        {/* Success - confirmation */}
        {state === 'success' && parsedData && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl border border-ws-border p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={18} className="text-ws-green" />
              <p className="text-sm font-medium text-ws-text">
                Found {parsedData.accounts.length} account{parsedData.accounts.length !== 1 ? 's' : ''},{' '}
                {formatCurrency(parsedData.totalValue)} total
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {parsedData.accounts.map((acct, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-ws-bg"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-ws-text-tertiary" />
                    <span className="text-sm text-ws-text">{acct.name}</span>
                    <span className="text-[10px] text-ws-text-tertiary uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-ws-border">
                      {ACCOUNT_TYPE_LABELS[acct.type] || acct.type}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ws-text tabular-nums">
                    {formatCurrency(acct.marketValue)}
                  </span>
                </div>
              ))}
            </div>

            {parsedData.warnings && parsedData.warnings.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-ws-yellow-light">
                <p className="text-xs text-ws-text-secondary">
                  {parsedData.warnings.join(' ')}
                </p>
              </div>
            )}

            <p className="text-xs text-ws-text-tertiary mb-4">
              Does this look right? You can edit any value after import.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-ws-black hover:bg-ws-dark text-white rounded-xl"
              >
                Looks good, continue
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="rounded-xl border-ws-border text-ws-text-secondary"
              >
                Re-upload
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl border border-ws-border p-6"
          >
            <div className="flex items-start gap-2 mb-4">
              <AlertCircle size={18} className="text-ws-red mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-ws-text mb-1">
                  Couldn't read that file
                </p>
                <p className="text-xs text-ws-text-secondary">
                  {errorMessage}
                </p>
              </div>
              <button onClick={handleReset} className="ml-auto shrink-0">
                <X size={14} className="text-ws-text-tertiary" />
              </button>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleReset}
                className="flex-1 bg-ws-black hover:bg-ws-dark text-white rounded-xl"
              >
                Try again
              </Button>
              <Button
                onClick={onCancel}
                variant="outline"
                className="flex-1 rounded-xl border-ws-border text-ws-text-secondary"
              >
                Use example data
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
