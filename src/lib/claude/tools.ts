import type Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_simulation',
    description:
      'Queue a simulation of 1,000 possible financial futures with scenario overrides. The simulation runs on the user\'s device AFTER your response - you will NOT receive the results. Describe the scenario qualitatively and direct the user to check the dashboard chart for exact numbers. NEVER invent specific dollar amounts or percentages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scenario_name: {
          type: 'string',
          description: 'A short descriptive name for this scenario (e.g., "Buy Home 2028", "Early Retirement")',
        },
        retirement_age: {
          type: 'number',
          description: 'Override retirement age (default: profile retirement age)',
        },
        annual_savings_rate: {
          type: 'number',
          description: 'Override annual savings rate as decimal (e.g., 0.30 for 30%)',
        },
        additional_income: {
          type: 'number',
          description: 'Additional annual income (e.g., side hustle, rental income)',
        },
        home_purchase_year: {
          type: 'number',
          description: 'Year to purchase a home',
        },
        home_purchase_price: {
          type: 'number',
          description: 'Home purchase price in dollars',
        },
        home_down_payment_percent: {
          type: 'number',
          description: 'Down payment as decimal (e.g., 0.20 for 20%)',
        },
        child_year: {
          type: 'number',
          description: 'Year of first child',
        },
        child_annual_cost: {
          type: 'number',
          description: 'Estimated annual cost increase per child (default: $18,000)',
        },
        career_change_year: {
          type: 'number',
          description: 'Year of career change or job loss',
        },
        career_new_income: {
          type: 'number',
          description: 'Permanent annual income AFTER the gap period ends. REQUIRED when career_change_year is set. For temporary layoff (return to same job), use the current salary. For permanent career exit (never work again), use 0.',
        },
        career_gap_months: {
          type: 'number',
          description: 'Months of zero income before the new income starts (0 = no gap). Defaults to 3 if omitted.',
        },
        market_crash_year: {
          type: 'number',
          description: 'Year of market crash',
        },
        market_crash_severity: {
          type: 'string',
          enum: ['mild', 'moderate', 'severe'],
          description: 'Severity: mild (-15%), moderate (-30%), severe (-45%)',
        },
        inflation_rate: {
          type: 'number',
          description: 'Override inflation rate as decimal (e.g., 0.03 for 3%)',
        },
        life_expectancy: {
          type: 'number',
          description: 'Override life expectancy age (e.g., 85)',
        },
        desired_retirement_income: {
          type: 'number',
          description: 'Override desired annual retirement spending in today\'s dollars. IMPORTANT: When the user says "X% of my spending", calculate X% of the Baseline Retirement Spending from their profile (NOT their income). For example, if baseline spending is $40,800/year and the user says 70%, pass 28560.',
        },
        contribution_timing: {
          type: 'string',
          enum: ['annual', 'monthly'],
          description: 'Contribution timing: "annual" for lump sum once a year (default), "monthly" for automated monthly contributions',
        },
      },
      required: ['scenario_name'],
    },
  },
  {
    name: 'compare_scenarios',
    description:
      'Compare two or more previously simulated scenarios side by side. Shows deltas in retirement net worth, success rate, and risk metrics. Use when the user wants to see how scenarios stack up.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scenario_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of scenarios to compare (must match previously run simulations)',
        },
      },
      required: ['scenario_names'],
    },
  },
  {
    name: 'get_portfolio_summary',
    description:
      'Get a detailed breakdown of the user\'s current portfolio allocation by asset class, account type, and key metrics. Use when the user asks about their current portfolio or allocation.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_goal',
    description:
      'Add a new financial goal to the user\'s profile. Goals are used in simulation analysis to track probability of achievement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_type: {
          type: 'string',
          enum: ['retirement', 'home-purchase', 'education', 'emergency-fund', 'major-purchase', 'debt-payoff', 'custom'],
          description: 'Type of financial goal',
        },
        name: {
          type: 'string',
          description: 'Description of the goal',
        },
        target_amount: {
          type: 'number',
          description: 'Target dollar amount',
        },
        target_year: {
          type: 'number',
          description: 'Target year to achieve goal',
        },
        priority: {
          type: 'string',
          enum: ['essential', 'important', 'aspirational'],
          description: 'Priority level of the goal',
        },
      },
      required: ['goal_type', 'name', 'target_amount', 'target_year', 'priority'],
    },
  },
  {
    name: 'update_profile',
    description:
      'Update a field in the user\'s financial profile. Use when the user provides new information about their finances.',
    input_schema: {
      type: 'object' as const,
      properties: {
        field: {
          type: 'string',
          enum: [
            'age', 'province', 'annualIncome', 'monthlyExpenses',
            'annualSavingsRate', 'retirementAge', 'inflationRate', 'lifeExpectancy',
            'desiredRetirementIncome',
          ],
          description: 'The profile field to update',
        },
        value: {
          type: 'number',
          description: 'The new value for numeric fields',
        },
        string_value: {
          type: 'string',
          description: 'The new value for string fields (e.g., province)',
        },
      },
      required: ['field'],
    },
  },
  {
    name: 'synthesize_scenarios',
    description:
      'Analyze and compare ALL saved scenarios at once to identify the best/worst outcomes, largest swings, and risk asymmetries. Use when 3+ scenarios exist and the user asks for an overall summary, "which is best?", or "what should I focus on?". You receive exact metrics from each scenario - cite every number precisely.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_sensitivity_analysis',
    description:
      'Run sensitivity analysis to identify which variable has the biggest impact on retirement outcomes. Perturbs 5 variables (savings rate, retirement age, market returns, inflation, life expectancy) one at a time and measures the effect. Use when the user asks "What matters most?", "What should I focus on?", or "What has the biggest impact?". Returns exact deltas from real simulation runs - report them precisely.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'reverse_engineer_goal',
    description:
      'Run binary search to find the EXACT value of a controllable variable (savings rate, retirement age, or desired retirement income) where the user\'s money lasts through their life expectancy. Use when the user asks "What do I need to save?", "When can I afford to retire?", or "How much can I spend in retirement?". Returns the EXACT solved value - report it precisely, never round or approximate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        variable: {
          type: 'string',
          enum: ['savings_rate', 'retirement_age', 'desired_retirement_income'],
          description: 'Which variable to solve for: savings_rate (what % to save), retirement_age (when to retire), desired_retirement_income (how much to spend)',
        },
        target_age: {
          type: 'number',
          description: 'Target age for money to last to (defaults to life expectancy from profile)',
        },
        retirement_age: {
          type: 'number',
          description: 'Retirement age context for the solver (e.g., if solving savings rate for early retirement at 55). Defaults to profile retirement age.',
        },
      },
      required: ['variable'],
    },
  },
  {
    name: 'explain_tradeoff',
    description:
      'Generate a structured tradeoff analysis between two financial choices. Use when the user is weighing options and wants a balanced perspective.',
    input_schema: {
      type: 'object' as const,
      properties: {
        option_a: {
          type: 'string',
          description: 'First option description',
        },
        option_b: {
          type: 'string',
          description: 'Second option description',
        },
        context: {
          type: 'string',
          description: 'Additional context about the user\'s situation relevant to this decision',
        },
      },
      required: ['option_a', 'option_b'],
    },
  },
];
