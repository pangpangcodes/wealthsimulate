# Wealthsimulate

AI-powered Monte Carlo financial life simulator for Canadians.

## The Problem

Most Canadians don't have access to the probabilistic financial planning that wealth managers charge thousands for. Spreadsheets can model one future - but life doesn't follow a single path. Market returns vary, jobs change, plans shift. Without understanding the range of outcomes, people either over-save out of anxiety or under-save out of optimism.

## The Solution

Wealthsimulate lets you explore financial decisions in natural language. Upload your Wealthsimple statement (or start with example data), ask "what if" questions - buy a home, change careers, retire early - and see the impact across 1,000 simulated futures with real Canadian tax rules.

The AI doesn't just answer questions. It runs full Monte Carlo simulations, compares scenarios side by side, and explains trade-offs in plain English - not financial jargon.

## Features

### Simulation Engine
- **1,000-path Monte Carlo** with deterministic seeding - Path #N gets identical market returns across scenarios, isolating the impact of your decisions from random noise
- **Correlated asset returns** via Cholesky decomposition across 10 asset classes (Canadian/US/international/emerging equities, Canadian/international/high-yield bonds, gold, cash, real estate)
- **30+ year projections** from current age through life expectancy (default 90)
- **Life event probabilities** - random job loss (2% annually), medical emergencies, and windfalls vary per path to show the distribution of outcomes

### Canadian Tax Rules
- **Federal + provincial tax brackets** for all 13 provinces and territories (2025 rates)
- **Registered account logic** - TFSA/FHSA (tax-free), RRSP (tax-deferred, taxed on withdrawal), RESP (income-tested withdrawal), non-registered (50% capital gains inclusion)
- **Contribution limits** - TFSA $7k, RRSP 18% of income (max $31,560), FHSA $8k
- **Government pensions** - CPP (adjustable start age 60-65 with early/late penalties), OAS at 65 with clawback above ~$92k

### AI Chat
- **Two-phase architecture** - Claude interprets the question and builds scenario parameters (Phase 1), then analyzes real simulation results (Phase 2). AI never invents financial numbers
- **Natural language scenarios** - "What if I buy a home in 2028 for $500k?" becomes a structured simulation with mortgage payments, down payment, and opportunity cost
- **Scenario comparison** - ask Claude to compare any saved scenarios side by side
- **Voice input** via browser speech recognition

### Scenario Modelling
- Career changes (new income, unemployment gap, EI/severance)
- Home purchases (price, down payment %, mortgage calculation)
- Children (year born, annual cost increase)
- Market crashes (mild/moderate/severe)
- Retirement age and income target changes
- Savings rate adjustments and extra account contributions
- **Scenario variants** - tweak assumptions (inflation, savings rate, retirement age, life expectancy) from any saved scenario via the variant popover

### Dashboard
- **Net worth timeline** - p10 (worst case), p50 (most likely), p90 (best case) with scenario overlay
- **Scenario metric cards** - retirement income, income replacement %, money lasts to age X, delta vs. baseline
- **Portfolio breakdown** by asset class
- **Holdings list** with individual positions
- **Accounts list** with balances across registered/non-registered types
- **Transactions list** with categorized spending (groceries, dining, transport, utilities, subscriptions, shopping, entertainment, health, insurance)
- **Model assumptions panel** - view and understand the parameters behind each simulation
- **Inline editing** - edit numeric values directly in the dashboard

### Onboarding
- **Statement upload** - drag-and-drop a Wealthsimple PDF or screenshot; Claude vision extracts accounts, holdings, and balances
- **Example profile** - start immediately with seed data (Alex, 33, Ontario, $59k income)
- **4-step review wizard** - employment, finances, goals, and risk tolerance with animated transitions
- **Auto-detection** - infers biweekly income from paycheck patterns and derives monthly expenses from transaction categories

## Key Technical Decisions

- **Deterministic seeded PRNG** - Path #N gets identical market returns across scenarios, so when you compare "retire at 60 vs 65", the only variable is your decision - not random noise
- **Cholesky-decomposed correlated returns** - Asset classes don't move independently. Canadian equities, US equities, bonds, and gold have realistic correlation structures
- **Canadian tax-aware** - Federal + provincial brackets, RRSP/TFSA/FHSA/RESP contribution logic, registered account withdrawal priority optimization
- **Two-phase AI architecture** - Claude analyzes the question and builds scenario parameters, then the deterministic engine runs the simulation. AI never invents financial numbers
- **Client-side Web Worker** - 1,000-path Monte Carlo runs in a background thread without blocking the UI
- **Statement parsing via Claude vision** - Upload a Wealthsimple PDF or screenshot and Claude extracts your actual portfolio data

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
│   │   └── insights.ts                 # Summary generation and verdicts
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
│   │   └── ModelAssumptions.tsx        # Simulation parameters panel
│   ├── simulation/
│   │   ├── SimulationModal.tsx         # Full-screen results breakdown
│   │   └── SimulationBreakdown.tsx     # Detailed results view
│   ├── chat/
│   │   ├── ChatBubble.tsx             # Floating toggle button
│   │   ├── ChatPanel.tsx              # Message list, input, voice
│   │   └── ChatMessage.tsx            # AI/user message rendering
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
- **Goal tracking integration** - Connect to Wealthsimple Goals for unified planning

The statement upload flow in this prototype demonstrates the data bridge - showing how real account data transforms the simulation from hypothetical to personal.
