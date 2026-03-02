'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '@/lib/store/profile-store';
import {
  ArrowRight,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Link2,
  LineChart,
  Sparkles,
  Database,
  Mic,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatementUpload } from '@/components/onboarding/StatementUpload';

export default function OnboardingPage() {
  const router = useRouter();
  const { setOnboarded, loadSeedProfile } = useProfileStore();
  const [showPaths, setShowPaths] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleStart = () => {
    setShowPaths(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeedStart = () => {
    loadSeedProfile();
    setOnboarded(true);
    router.push('/review');
  };

  const handleUploadComplete = () => {
    router.push('/review');
  };

  return (
    <div className="min-h-screen bg-ws-cream text-ws-dark font-sans selection:bg-ws-green selection:text-white">
      {/* Navigation - not sticky */}
      <nav className="px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ws-dark rounded-full flex items-center justify-center text-white">
            <TrendingUp size={16} />
          </div>
          <span className="font-serif font-semibold text-xl tracking-tight">Wealthsimulate</span>
        </div>
        <div className="flex items-center gap-6">
<button
            onClick={handleStart}
            className="text-sm font-medium bg-ws-dark text-white px-5 py-2.5 rounded-full hover:bg-ws-dark/90 transition-colors cursor-pointer"
          >
            Start simulation
          </button>
        </div>
      </nav>

      <main className="pb-20 px-6 md:px-12 max-w-7xl mx-auto">
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
              <div className="grid lg:grid-cols-2 gap-16 items-start mb-32 pt-12">
                <div className="max-w-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ws-green/10 text-ws-green text-xs font-bold tracking-wide uppercase mb-6"
                  >
                    <Sparkles size={12} />
                    AI Financial Co-pilot
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="font-serif text-5xl md:text-7xl leading-[1.1] mb-8 text-ws-dark tracking-tight"
                  >
                    Your wealth needs a <span className="italic text-ws-green">co-pilot</span>, not just a calculator.
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-lg md:text-xl text-ws-dark/70 leading-relaxed mb-10 max-w-lg"
                  >
                    Most tools just display data. Wealthsimulate <strong>notices</strong> things. It monitors your plan 24/7, flags risks like "thin emergency buffer," and answers "what if" questions instantly.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <AnimatePresence mode="wait">
                      {!showPaths ? (
                        <motion.div
                          key="cta-buttons"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="flex flex-col sm:flex-row gap-4"
                        >
                          <button
                            onClick={handleStart}
                            className="group relative inline-flex items-center justify-center gap-3 bg-ws-dark text-white px-8 py-4 rounded-full text-lg font-medium transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            Start your simulation
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
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
                          <div className="grid grid-cols-2 gap-4 max-w-md">
                            <button
                              onClick={() => {
                                setShowComingSoon(true);
                                setTimeout(() => setShowComingSoon(false), 2000);
                              }}
                              className="group relative bg-white rounded-2xl border border-ws-dark/5 p-6 text-left hover:border-ws-dark/10 hover:shadow-xl hover:shadow-ws-dark/5 transition-all duration-300 cursor-pointer"
                            >
                              <Link2 size={20} className="text-ws-green mb-3" />
                              <p className="text-sm font-medium text-ws-text mb-1">
                                Connect your Wealthsimple account
                              </p>
                              <p className="text-xs text-ws-dark/50">
                                Securely link your account in seconds
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
                              className="group bg-white rounded-2xl border border-ws-dark/5 p-6 text-left hover:border-ws-dark/10 hover:shadow-xl hover:shadow-ws-dark/5 transition-all duration-300 cursor-pointer"
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
                  </motion.div>
                </div>

                {/* Hero Visual - Abstract UI Representation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-ws-green/20 to-transparent rounded-[2.5rem] blur-3xl -z-10" />
                  <div className="bg-white rounded-[2rem] shadow-2xl border border-ws-dark/5 p-6 md:p-8 relative overflow-hidden min-h-[500px] flex flex-col">

                    {/* Sidebar Simulation */}
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gray-50 border-l border-gray-100 p-4 hidden md:flex flex-col gap-4">
                      <div className="flex items-center gap-2 mb-4 opacity-50">
                        <div className="w-2 h-2 bg-ws-green rounded-full animate-pulse" />
                        <span className="text-xs font-medium uppercase tracking-wider">Co-pilot Active</span>
                      </div>

                      {/* Chat Bubble 1 */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 }}
                        className="bg-white p-3 rounded-2xl rounded-tr-sm shadow-sm border border-gray-100 text-xs text-gray-600"
                      >
                        I noticed your emergency fund is a bit thin (1.2 months). Recommended is 3-6 months.
                      </motion.div>

                      {/* Chat Bubble 2 */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 2.5 }}
                        className="bg-ws-dark text-white p-3 rounded-2xl rounded-br-sm shadow-sm text-xs self-end"
                      >
                        What happens if I lose my job?
                      </motion.div>

                      {/* Chat Bubble 3 */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 4 }}
                        className="bg-white p-3 rounded-2xl rounded-tr-sm shadow-sm border border-gray-100 text-xs text-gray-600"
                      >
                        Running simulation: "Job Loss - No EI". Your runway drops to 4 months.
                      </motion.div>
                    </div>

                    {/* Main Content Simulation */}
                    <div className="md:w-2/3 pr-4 space-y-6 opacity-90">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Net Worth at 65</div>
                          <div className="text-4xl font-semibold tracking-tight text-ws-dark">$921,000</div>
                        </div>
                        <div className="text-ws-green font-medium bg-ws-green/10 px-2 py-1 rounded text-sm">+12% vs baseline</div>
                      </div>

                      <div className="h-48 w-full bg-ws-cream/50 rounded-xl relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 h-full flex items-end px-4 pb-0 gap-2">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="flex-1 bg-ws-dark/10 rounded-t-sm" style={{ height: `${30 + i * 8}%` }} />
                          ))}
                          <div className="absolute bottom-0 left-0 right-0 h-[70%] bg-gradient-to-t from-white to-transparent" />
                          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            <path d="M0,150 C50,140 100,80 300,20" stroke="#004530" strokeWidth="3" fill="none" />
                          </svg>
                        </div>
                      </div>

                      {/* Insight Cards */}
                      <div className="grid gap-3">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3"
                        >
                          <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                            <ShieldAlert size={14} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-amber-900">Thin Emergency Buffer</div>
                            <div className="text-xs text-amber-700/80 mt-0.5">You have 1.2 months of expenses covered.</div>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 }}
                          className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-start gap-3"
                        >
                          <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                            <Globe size={14} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-blue-900">Home Bias Detected</div>
                            <div className="text-xs text-blue-700/80 mt-0.5">45% of your equity is Canadian.</div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Value Props Grid */}
              <div className="mb-32">
                <div className="text-center mb-16">
                  <h2 className="text-xs font-bold tracking-widest uppercase text-ws-dark/40 mb-4">The AI Advantage</h2>
                  <h3 className="font-serif text-3xl md:text-4xl tracking-tight">Three layers of financial intelligence.</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    {
                      icon: <ShieldAlert className="w-6 h-6" />,
                      title: '1. Proactive Alerts',
                      desc: "It doesn't wait for you to log in. It flags risks like 'Emergency fund too low' so you can act.",
                      color: 'bg-amber-50 text-amber-600',
                    },
                    {
                      icon: <LineChart className="w-6 h-6" />,
                      title: '2. Probabilistic Forecasting',
                      desc: 'Instead of one number, it runs 1,000 simulated futures — worst case, most likely, best case. Every answer comes with a range, not a false sense of certainty.',
                      color: 'bg-blue-50 text-blue-600',
                    },
                    {
                      icon: <MessageSquare className="w-6 h-6" />,
                      title: '3. Conversational Modeling',
                      desc: "Don't fiddle with sliders. Just ask 'What if I take a sabbatical?' or 'Can I afford a mortgage?' and watch the chart update.",
                      color: 'bg-ws-green/10 text-ws-green',
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -5 }}
                      className="p-8 rounded-3xl bg-white border border-ws-dark/5 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                      <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center mb-6`}>
                        {item.icon}
                      </div>
                      <h4 className="font-semibold text-xl mb-3 tracking-tight">{item.title}</h4>
                      <p className="text-ws-dark/60 leading-relaxed text-sm">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Feature Deep Dive - Dark Mode */}
              <div className="bg-ws-dark text-ws-cream rounded-[2.5rem] p-8 md:p-20 overflow-hidden relative mb-24">
                <div className="absolute top-0 right-0 w-96 h-96 bg-ws-green opacity-20 blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3"></div>

                <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold tracking-wide uppercase mb-6 border border-white/10">
                      <Mic size={12} />
                      Voice & Chat Interface
                    </div>
                    <h2 className="font-serif text-4xl md:text-5xl mb-6 leading-tight tracking-tight">
                      "Hey, am I on track<br />to retire at 60?"
                    </h2>
                    <div className="space-y-6 mb-8">
                      <p className="text-ws-cream/80 text-lg leading-relaxed">
                        Stop interpreting complex charts. Just talk to your finances. The AI Co-pilot sits right next to your data, ready to answer questions, run simulations, and explain the "why" behind every number.
                      </p>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 text-white/60 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-ws-green"></div>
                          "Explain why my net worth drops in 2045"
                        </div>
                        <div className="flex items-center gap-3 text-white/60 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-ws-green"></div>
                          "Simulate a market crash of 20%"
                        </div>
                        <div className="flex items-center gap-3 text-white/60 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-ws-green"></div>
                          "How much can I spend on a renovation?"
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleStart}
                      className="text-white border-b border-white/30 pb-1 hover:border-white transition-colors cursor-pointer"
                    >
                      Try the demo
                    </button>
                  </div>

                  {/* Mock Chat UI */}
                  <div className="bg-ws-cream/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 relative">
                    <div className="absolute -top-4 -right-4 bg-ws-green text-ws-dark px-4 py-2 rounded-full text-xs font-bold shadow-lg transform rotate-6">
                      Live Demo
                    </div>
                    <div className="space-y-4">
                      {/* AI Message */}
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-ws-green flex items-center justify-center text-ws-dark shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 text-sm text-white/90 leading-relaxed">
                          Based on your current savings rate of 15%, you are on track to retire at 62 with $1.2M. However, if you increase savings by 2%, you could retire at 59.
                        </div>
                      </div>

                      {/* User Message */}
                      <div className="flex gap-3 justify-end">
                        <div className="bg-ws-green text-ws-dark rounded-2xl rounded-tr-none p-4 text-sm font-medium">
                          What if I take a career break next year?
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                          <span className="text-xs">ME</span>
                        </div>
                      </div>

                      {/* AI Typing */}
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-ws-green flex items-center justify-center text-ws-dark shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 flex gap-1 items-center">
                          <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce delay-75"></div>
                          <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce delay-150"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="font-serif text-4xl mb-6 tracking-tight">Ready to see your future?</h2>
                <p className="text-ws-dark/60 mb-8 text-lg">
                  Join thousands of Canadians taking control of their financial destiny. No credit card required.
                </p>
                <button
                  onClick={handleStart}
                  className="bg-ws-dark text-white px-10 py-4 rounded-full text-lg font-medium hover:scale-105 transition-transform shadow-xl shadow-ws-dark/20 cursor-pointer"
                >
                  Start your free simulation
                </button>
                <p className="mt-6 text-xs text-ws-dark/40">
                  Secure - Private - Read-only access
                </p>
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
                  Connect your Wealthsimple account
                </h2>
                <p className="text-sm text-ws-dark/60">
                  We'll securely sync your accounts and holdings automatically
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

      <footer className="py-12 px-6 border-t border-ws-dark/5 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-ws-dark rounded-full flex items-center justify-center text-white">
              <TrendingUp size={12} />
            </div>
            <span className="font-serif font-bold text-lg">Wealthsimulate</span>
          </div>
          <div className="flex gap-8 text-sm text-ws-dark/60">
            <a href="#" className="hover:text-ws-dark">Privacy</a>
            <a href="#" className="hover:text-ws-dark">Security</a>
            <a href="#" className="hover:text-ws-dark">Terms</a>
          </div>
          <p className="text-ws-dark/40 text-sm">&copy; {new Date().getFullYear()} Wealthsimulate Financial Inc.</p>
        </div>
      </footer>
    </div>
  );
}
