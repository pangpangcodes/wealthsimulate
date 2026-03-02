# Wealthsimulate

AI-powered Monte Carlo financial life simulator for Canadians.

## The Problem

Wealthsimple shows you what you have. It can't help you reason about your future. When a 33-year-old user wants to know whether she can afford a career break in her 30s, she goes on Reddit. She gets a rule of thumb. She has no way to run that question against her actual accounts, tax bracket, savings rate, and retirement trajectory — and get a probabilistic answer, not a single number.

## The Solution

Wealthsimulate adds a reasoning layer on top of existing Wealthsimple data. Before you've typed a word, the AI has already noticed your emergency fund is thin and that your savings habits have long-term compounding costs. Then you ask your question in plain English — change careers, retire early, take a sabbatical — and see the impact across 1,000 simulated futures with real Canadian tax rules.

The AI takes on genuine cognitive responsibility: it detects income from deposit patterns, infers your financial picture from transaction history, and surfaces risks and opportunities before you ask. Then it explains what 1,000 simulated paths mean for your specific income, tax bracket, and retirement trajectory — not a generic calculator.

## Features

### Simulation Engine
- **1,000-path Monte Carlo** with deterministic seeding - Path #N gets identical market returns across scenarios, isolating the impact of your decisions from random noise
- **Correlated asset returns** via Cholesky decomposition across 10 asset classes (Canadian/US/international/emerging equities, Canadian/international/high-yield bonds, gold, cash, real estate)
- **30+ year projections** from current age through life expectancy (default 90)
- **Life event probabilities** - random job loss (2% annually), medical emergencies, and windfalls vary per path to show the distribution of outcomes
- **Goal-backward solver** - binary search over controllable variables (savings rate, retirement age) to find the value where money lasts through life expectancy
- **Sensitivity analysis** - perturbs each variable independently (11 simulation runs) to show which levers have the most impact on outcomes

### Canadian Tax Rules
- **Federal + provincial tax brackets** for all 13 provinces and territories (2025 rates)
- **Registered account logic** - TFSA/FHSA (tax-free), RRSP (tax-deferred, taxed on withdrawal), RESP (income-tested withdrawal), non-registered (50% capital gains inclusion)
- **Contribution limits** - TFSA $7k, RRSP 18% of income (max $31,560), FHSA $8k
- **Government pensions** - CPP (adjustable start age 60-65 with early/late penalties), OAS at 65 with clawback above ~$92k

### AI Co-pilot
- **Two-phase architecture** - Claude interprets the question and builds scenario parameters (Phase 1), then analyzes real simulation results (Phase 2). AI never invents financial numbers
- **Natural language scenarios** - "What if I take a career break next year?" or "What if I lose my job for 6 months?" becomes a structured simulation with cash flow gap, emergency runway, and retirement impact
- **Scenario comparison** - ask Claude to compare any saved scenarios side by side
- **Voice input** via browser speech recognition

### Scenario Modelling
- Career changes (new income, unemployment gap, EI/severance)
- Market crashes (mild/moderate/severe)
- Retirement age and income target changes
- Savings rate adjustments and extra account contributions
- **Scenario variants** - tweak assumptions (inflation, savings rate, retirement age, life expectancy) from any saved scenario via the variant popover

### Dashboard
- **Net worth timeline** - p10 (worst case), p50 (most likely), p90 (best case) with scenario overlay
- **Scenario metric cards** - retirement income, income replacement %, money lasts to age X, delta vs. baseline
- **Sensitivity analysis** - "What moves the needle" display showing the impact of perturbing key variables (savings rate, retirement age, market returns, inflation, life expectancy) via real simulation runs
- **Portfolio breakdown** by asset class
- **Holdings list** with individual positions
- **Accounts list** with balances across registered/non-registered types
- **Transactions list** with categorized spending (groceries, dining, transport, utilities, subscriptions, shopping, entertainment, health, insurance)
- **Proactive insights** - AI-generated warnings, opportunities, and contextual prompts based on your profile and simulation results
- **Model assumptions panel** - view and understand the parameters behind each simulation
- **Inline editing** - edit numeric values directly in the dashboard

### Onboarding
- **Account connection** - connect your Wealthsimple account to sync accounts, holdings, and balances (prototype uses drag-and-drop statement upload with Claude vision extraction)
- **Example profile** - start immediately with seed data (Alex, 33, Ontario, $75k income, RRSP + TFSA, 90 days of transaction history)
- **4-step review wizard** - employment, finances, goals, and risk tolerance with animated transitions
- **Auto-detection** - infers biweekly income from paycheck patterns and derives monthly expenses from transaction categories

## Key Technical Decisions

- **Deterministic seeded PRNG** - Path #N gets identical market returns across scenarios, so when you compare "retire at 60 vs 65", the only variable is your decision - not random noise
- **Cholesky-decomposed correlated returns** - Asset classes don't move independently. Canadian equities, US equities, bonds, and gold have realistic correlation structures
- **Canadian tax-aware** - Federal + provincial brackets, RRSP/TFSA/FHSA/RESP contribution logic, registered account withdrawal priority optimization
- **Two-phase AI architecture** - Claude analyzes the question and builds scenario parameters, then the deterministic engine runs the simulation. AI never invents financial numbers
- **Client-side Web Worker** - 1,000-path Monte Carlo runs in a background thread without blocking the UI
- **Statement parsing via Claude vision** - Prototype uses PDF/screenshot upload with Claude vision to extract portfolio data; production would use direct Wealthsimple API sync

## Tech Stack

- **Next.js 16** (App Router) with React 19
- **Zustand** for client state (profile, simulation results, UI)
- **Recharts** for data visualization
- **Framer Motion** for animations and transitions
- **Radix UI** + **shadcn/ui** for accessible components
- **Tailwind CSS 4** for styling
- **Anthropic SDK** for Claude integration (chat + vision)
- **Web Worker** for non-blocking simulation execution

## How to Run Locally

```bash
# Install dependencies
npm install

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Landing / onboarding
│   ├── review/page.tsx                 # Profile setup wizard
│   ├── simulator/page.tsx              # Main dashboard
│   └── api/
│       ├── chat/route.ts               # Claude chat (tool-calling, two-phase)
│       └── parse-statement/route.ts    # Claude vision statement parsing
├── lib/
│   ├── simulation/
│   │   ├── engine.ts                   # Monte Carlo engine (1,000 paths x 30+ years)
│   │   ├── distributions.ts            # Correlated asset returns (Cholesky)
│   │   ├── canadian-tax.ts             # Federal + provincial tax brackets
│   │   ├── government-pensions.ts      # CPP / OAS calculation
│   │   ├── scenarios.ts                # Life event probabilities
│   │   ├── insights.ts                 # Summary generation and verdicts
│   │   ├── sensitivity.ts              # "What moves the needle" perturbation analysis
│   │   ├── goal-solver.ts              # Goal-based parameter solver
│   │   └── limitations.ts              # Model limitation disclosures
│   ├── analysis/
│   │   ├── income-detection.ts         # Infer income from transaction patterns
│   │   └── expense-detection.ts        # Derive monthly expenses by category
│   ├── claude/
│   │   ├── system-prompt.ts            # Claude instructions (Phase 1 vs 2)
│   │   └── tools.ts                    # Claude tool definitions
│   ├── store/
│   │   ├── profile-store.ts            # Financial profile state
│   │   ├── simulation-store.ts         # Simulation results and UI state
│   │   ├── seed-data.ts                # Default example profile
│   │   └── seed-transactions.ts        # Mock bank transactions
│   ├── hooks/
│   │   ├── useSimulation.ts            # Run simulations (Web Worker or main thread)
│   │   ├── useChat.ts                  # Chat API calls and result condensing
│   │   └── useVoiceInput.ts            # Voice transcription
│   └── types/
│       ├── financial.ts                # Account, Profile, Goal types
│       ├── simulation.ts               # SimulationConfig, Results, Summary
│       └── chat.ts                     # ChatMessage, ToolCall types
├── components/
│   ├── onboarding/
│   │   └── StatementUpload.tsx         # PDF/screenshot upload with drag-drop
│   ├── review/
│   │   ├── ReviewWelcome.tsx           # Welcome screen
│   │   ├── ReviewStepEmployment.tsx    # Step 1: Employment info
│   │   ├── ReviewStepFinances.tsx      # Step 2: Accounts and holdings
│   │   ├── ReviewStepGoals.tsx         # Step 3: Retirement goals
│   │   ├── ReviewStepRisk.tsx          # Step 4: Risk tolerance
│   │   ├── ReviewProgress.tsx          # Progress bar
│   │   └── ReviewConfirmField.tsx      # Inline confirmation field
│   ├── dashboard/
│   │   ├── NetWorthTimeline.tsx        # Main chart with scenario overlay
│   │   ├── ScenarioMetricCards.tsx     # Retirement metrics and deltas
│   │   ├── ScenarioCompare.tsx         # Scenario selector
│   │   ├── ScenarioVariantPopover.tsx  # Tweak assumptions from a scenario
│   │   ├── PortfolioBreakdown.tsx      # Asset allocation chart
│   │   ├── AccountsList.tsx            # Account balances
│   │   ├── HoldingsList.tsx            # Individual positions
│   │   ├── TransactionsList.tsx        # Categorized spending
│   │   ├── MetricCard.tsx              # Reusable metric display
│   │   ├── ModelAssumptions.tsx        # Simulation parameters panel
│   │   └── ProactiveInsights.tsx      # Contextual AI prompt suggestions
│   ├── simulation/
│   │   ├── SimulationModal.tsx         # Full-screen results breakdown
│   │   ├── SimulationBreakdown.tsx     # Collapsible assumptions breakdown
│   │   └── SensitivityChart.tsx        # "What moves the needle" perturbation display
│   ├── chat/
│   │   ├── ChatBubble.tsx             # Floating toggle button
│   │   ├── ChatPanel.tsx              # Message list, input, voice
│   │   ├── ChatMessage.tsx            # AI/user message rendering
│   │   └── CoPilotPanel.tsx           # AI co-pilot sidebar panel
│   └── shared/
│       └── Disclaimer.tsx             # "Not financial advice" banner
└── workers/
    └── monte-carlo.worker.ts          # Web Worker for background simulation
```

## What Real Integration Would Look Like

With Wealthsimple API access, Wealthsimulate could:

- **Live portfolio sync** - Pull real-time holdings, balances, and market prices instead of relying on uploaded statements
- **Contribution room tracking** - Query actual RRSP/TFSA/FHSA contribution room from CRA data via Wealthsimple
- **Transaction history** - Infer spending patterns and savings rates from real transaction data
- **Automated rebalancing scenarios** - Model the impact of Wealthsimple's own rebalancing strategies
- **Goal tracking integration** - Sync savings targets and timelines against real account balances for unified planning

The statement upload flow in this prototype demonstrates the data bridge - showing how real account data transforms the simulation from hypothetical to personal.

## Future Exploration: Server-Side Response Validation

The two-phase AI architecture ensures Claude never generates financial numbers - a deterministic engine produces all figures, and Claude can only cite what it receives. This is enforced through multi-layer prompt guardrails, but these are instructions to the model, not code-level guarantees.

A future hardening step could add server-side validation to the chat API response stream:

- **Phase 1 responses** (post-tool-call, pre-results) should never contain dollar amounts or percentages. A regex scan before streaming could strip or flag violations with minimal latency, since Phase 1 responses are capped at 2-3 sentences.
- **Phase 2 responses** (post-simulation-results) legitimately contain numbers. Validation here would require cross-referencing cited figures against the `[SIMULATION_RESULTS]` payload - significantly more complex and higher false-positive risk.

Phase 1 validation is the clearest win: narrow scope, simple implementation, and it covers the primary fabrication risk surface.
