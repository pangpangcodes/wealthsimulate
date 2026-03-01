'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '@/lib/store/profile-store';
import {
  ArrowRight,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Upload,
  LineChart,
  Sparkles,
  Database,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatementUpload } from '@/components/onboarding/StatementUpload';

export default function OnboardingPage() {
  const router = useRouter();
  const { setOnboarded, loadSeedProfile } = useProfileStore();
  const [showPaths, setShowPaths] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const barHeights = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const base = 10 + (i / 19) * 70;
    const jitter = (Math.random() - 0.5) * 10;
    return Math.min(95, Math.max(5, base + jitter));
  }), []);

  const handleSeedStart = () => {
    loadSeedProfile();
    setOnboarded(true);
    router.push('/review');
  };

  const handleUploadComplete = () => {
    router.push('/review');
  };

  return (
    <div className="min-h-screen bg-ws-cream text-ws-text font-sans selection:bg-ws-green selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center mix-blend-multiply">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ws-dark rounded-full flex items-center justify-center text-white">
            <TrendingUp size={16} />
          </div>
          <span className="font-serif font-semibold text-xl tracking-tight">Simulate</span>
        </div>
        <button
          onClick={() => {
            loadSeedProfile();
            setOnboarded(true);
            router.push('/simulator');
          }}
          className="text-sm font-medium hover:opacity-70 transition-opacity"
        >
          Log in
        </button>
      </nav>

      <main className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {!showUpload ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero Section */}
              <div className="max-w-4xl mx-auto text-center mb-24">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.1] mb-8 text-ws-dark"
                >
                  What would your <span className="italic">financial future</span> look like?
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-lg md:text-xl text-ws-dark/70 max-w-2xl mx-auto leading-relaxed mb-10"
                >
                  Most Canadians can't access the Monte Carlo planning that wealth managers charge
                  thousands for. Simulate gives you 1,000 possible futures, powered by AI that speaks
                  plain English - not financial jargon.
                </motion.p>

                {/* CTA area */}
                <AnimatePresence mode="wait">
                  {!showPaths ? (
                    <motion.div
                      key="cta"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <button
                        onClick={() => setShowPaths(true)}
                        className="group relative inline-flex items-center gap-3 bg-ws-dark text-white px-8 py-4 rounded-full text-lg font-medium transition-transform hover:scale-105 active:scale-95"
                      >
                        Start exploring
                        <ArrowRight
                          size={20}
                          className="group-hover:translate-x-1 transition-transform"
                        />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="paths"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="text-sm text-ws-dark/50 mb-6">How would you like to begin?</p>
                      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                        <button
                          onClick={() => {
                            setShowComingSoon(true);
                            setTimeout(() => setShowComingSoon(false), 2000);
                          }}
                          className="group relative bg-white rounded-2xl border border-ws-dark/5 p-6 text-left hover:border-ws-dark/10 hover:shadow-xl hover:shadow-ws-dark/5 transition-all duration-300"
                        >
                          <Upload size={20} className="text-ws-green mb-3" />
                          <p className="text-sm font-medium text-ws-text mb-1">
                            Upload your statement
                          </p>
                          <p className="text-xs text-ws-dark/50">
                            Drop a Wealthsimple PDF or screenshot
                          </p>
                          <AnimatePresence>
                            {showComingSoon && (
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="absolute inset-0 flex items-center justify-center bg-white/95 rounded-2xl"
                              >
                                <span className="text-sm font-medium text-ws-dark/70">Coming soon</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                        <button
                          onClick={handleSeedStart}
                          className="group bg-white rounded-2xl border border-ws-dark/5 p-6 text-left hover:border-ws-dark/10 hover:shadow-xl hover:shadow-ws-dark/5 transition-all duration-300"
                        >
                          <Database size={20} className="text-ws-text-tertiary mb-3" />
                          <p className="text-sm font-medium text-ws-text mb-1">
                            Use example profile
                          </p>
                          <p className="text-xs text-ws-dark/50">Start with sample data</p>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* How it works */}
              <div className="mb-32">
                <div className="text-center mb-16">
                  <h2 className="text-xs font-bold tracking-widest uppercase text-ws-dark/40 mb-4">
                    How it works
                  </h2>
                  <div className="w-px h-12 bg-ws-dark/10 mx-auto"></div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
                  {[
                    {
                      step: '01',
                      icon: <Upload className="w-6 h-6" />,
                      title: 'Connect your data',
                      desc: 'Upload your Wealthsimple statement or start with example data to build your baseline.',
                    },
                    {
                      step: '02',
                      icon: <MessageSquare className="w-6 h-6" />,
                      title: 'Ask "what if"',
                      desc: 'Chat with your finances. Ask about buying a home, changing careers, or retiring early.',
                    },
                    {
                      step: '03',
                      icon: <LineChart className="w-6 h-6" />,
                      title: 'See the future',
                      desc: 'See the impact across 1,000 simulated futures with real Canadian tax rules applied.',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      className="group p-8 rounded-3xl bg-white border border-ws-dark/5 hover:border-ws-dark/10 hover:shadow-xl hover:shadow-ws-dark/5 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-8">
                        <span className="font-mono text-xs font-medium px-3 py-1 rounded-full border border-ws-dark/10 bg-ws-cream">
                          {item.step}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-ws-cream flex items-center justify-center text-ws-dark group-hover:bg-ws-green group-hover:text-white transition-colors duration-300">
                          {item.icon}
                        </div>
                      </div>
                      <h3 className="font-serif text-2xl mb-3">{item.title}</h3>
                      <p className="text-ws-dark/60 leading-relaxed">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Feature Pills */}
              <div className="flex flex-wrap justify-center gap-4 mb-24">
                {[
                  { icon: <MessageSquare size={16} />, text: 'Voice + chat powered' },
                  { icon: <Sparkles size={16} />, text: '1,000 simulated futures' },
                  { icon: <ShieldCheck size={16} />, text: 'Canadian tax rules' },
                ].map((pill, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-2 px-6 py-3 bg-white rounded-full border border-ws-dark/10 text-sm font-medium text-ws-dark/80 shadow-sm"
                  >
                    {pill.icon}
                    {pill.text}
                  </motion.div>
                ))}
              </div>

              {/* Editorial Section */}
              <div className="bg-ws-dark text-ws-cream rounded-[2.5rem] p-8 md:p-16 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-ws-green opacity-20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                  <div>
                    <h2 className="font-serif text-4xl md:text-5xl mb-6 leading-tight text-white">
                      Wealth management,
                      <br />
                      democratized.
                    </h2>
                    <p className="text-white/70 text-lg mb-8 max-w-md">
                      We believe everyone deserves access to sophisticated financial modelling. No
                      minimum balance required.
                    </p>
                    <button
                      onClick={() => setShowPaths(true)}
                      className="text-white border-b border-white/30 pb-1 hover:border-white transition-colors"
                    >
                      Get started free
                    </button>
                  </div>
                  <div className="relative aspect-square md:aspect-[4/3] bg-ws-dark/50 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center">
                    {/* Abstract chart visualization */}
                    <div className="absolute inset-0 flex items-end justify-center p-8 gap-1 opacity-60">
                      {barHeights.map((h, i) => (
                        <motion.div
                          key={i}
                          className="w-full bg-ws-green rounded-t-sm"
                          initial={{ height: '0%' }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: i * 0.05 }}
                        />
                      ))}
                    </div>
                    <div className="relative z-10 text-center">
                      <div className="text-5xl font-serif mb-2 text-white">$1.2M</div>
                      <div className="text-sm text-white/50 uppercase tracking-widest">
                        Projected at 65
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Upload view */
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto pt-8"
            >
              <div className="text-center mb-8">
                <h2 className="font-serif text-3xl text-ws-text tracking-tight mb-2">
                  Upload your statement
                </h2>
                <p className="text-sm text-ws-dark/60">
                  We'll extract your accounts and holdings automatically
                </p>
              </div>
              <StatementUpload
                onComplete={handleUploadComplete}
                onCancel={() => {
                  setShowUpload(false);
                  handleSeedStart();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 px-6 text-center text-ws-dark/40 text-sm">
        <p>&copy; {new Date().getFullYear()} Simulate Financial Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
