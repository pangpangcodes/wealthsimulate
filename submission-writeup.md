# Written Explanation

## What the human can now do that they couldn't before

A regular Canadian can now run the same probabilistic financial planning that wealth managers charge thousands for. Not a single spreadsheet forecast - 1,000 Monte Carlo simulations with correlated returns across 10 asset classes, real federal and provincial tax brackets for all 13 provinces, RRSP/TFSA/FHSA contribution logic, CPP/OAS/GIS government pensions, and RRIF mandatory withdrawals at 71+.

The user uploads a Wealthsimple statement (Claude vision extracts accounts, holdings, and balances), then asks natural language questions: "What if I buy a home in 2028 for $500K?" The system interprets the question into structured simulation parameters, runs 1,000 futures in a background thread, and explains the range of outcomes in plain English - worst case, most likely, best case, and what it means for their specific situation.

Previously, exploring 10 financial scenarios (home purchase, career change, market crash, early retirement) required multiple meetings with an advisor over months. Now it takes an afternoon.

## What AI is responsible for

Three layers of cognitive work:

1. **Interpretation.** Parsing natural language into simulation parameters. "Buy a home in 2028 for $500K with 15% down" becomes a structured scenario with mortgage calculations, down payment drawdown, and opportunity cost modelling. The AI asks clarification questions when key details are missing and offers sensible defaults.

2. **Analysis.** After the deterministic engine produces results, AI explains what 1,000 paths mean for this specific person - leading with retirement income, income replacement ratio, and how long money lasts. For disruptive scenarios like job loss, it calculates monthly cash flow gaps, liquid runway, and recovery options.

3. **Proactive insight.** Without being asked, the system flags portfolio concentration risk, tax inefficiency (non-registered contributions when RRSP room exists), thin emergency buffers, and income gaps - all derived from the user's actual data, never approximated.

## Where AI must stop

The AI must never give financial advice. This isn't just a disclaimer - it's enforced architecturally. The two-phase design means Claude interprets the question and builds parameters (Phase 1), then the deterministic engine runs client-side. Claude only sees financial numbers after they actually exist (Phase 2). It cannot fabricate figures because it never has the opportunity to.

The critical decision that must remain human: **whether to actually change your savings rate, buy a home, or retire early.** Risk tolerance is personal. Life priorities - caring for aging parents, switching careers for fulfilment over income, choosing where to live - can't be reduced to a number. The AI shows what could happen across 1,000 futures. The human decides what matters.

## What would break first at scale

API cost per user. Each conversation turn requires a Claude call, and the agentic tool loop can iterate up to five times before streaming a response. At scale, this becomes expensive quickly. The mitigation path is caching common scenario interpretations, moving the parsing layer to a smaller model, and reserving Claude for complex multi-scenario analysis where its reasoning depth justifies the cost. The second risk is assumption drift - the simulation uses static expected returns and tax brackets that need annual updating as markets and regulations change. At scale, stale assumptions erode trust.
