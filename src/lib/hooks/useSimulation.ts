'use client';

import { useCallback, useRef } from 'react';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { useProfileStore } from '@/lib/store/profile-store';
import type { ScenarioOverrides, SimulationConfig } from '@/lib/types';
import { runSimulation } from '@/lib/simulation/engine';

export function useSimulation() {
  const profile = useProfileStore((s) => s.profile);
  const {
    currentResults,
    isSimulating,
    simulationProgress,
    error,
    savedScenarios,
    setResults,
    setSimulating,
    setProgress,
    setError,
    saveScenario,
    compareScenarios,
  } = useSimulationStore();

  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const simulateOne = useCallback(
    async (scenario: ScenarioOverrides = { name: 'Current Path' }) => {
      // Read profile directly from store to always get the latest values
      // (avoids stale closure when called immediately after a profile update)
      const latestProfile = useProfileStore.getState().profile;
      setSimulating(true);

      const config: SimulationConfig = {
        numPaths: 1000,
        yearsToProject: Math.max(30, latestProfile.lifeExpectancy - latestProfile.age),
        startYear: new Date().getFullYear(),
        profile: latestProfile,
        scenario,
      };

      // Try Web Worker first, fall back to main thread
      try {
        if (typeof Worker !== 'undefined') {
          // Terminate existing worker
          if (workerRef.current) {
            workerRef.current.terminate();
          }

          const worker = new Worker(
            new URL('@/workers/monte-carlo.worker.ts', import.meta.url)
          );
          workerRef.current = worker;

          return new Promise<void>((resolve, reject) => {
            worker.onmessage = (event) => {
              const { type, results, error: workerError, progress } = event.data;

              if (type === 'simulation_progress' && progress !== undefined) {
                setProgress(progress);
              } else if (type === 'simulation_complete' && results) {
                setResults(results);
                saveScenario(results);
                worker.terminate();
                workerRef.current = null;
                resolve();
              } else if (type === 'simulation_error') {
                setError(workerError || 'Simulation failed');
                worker.terminate();
                workerRef.current = null;
                reject(new Error(workerError));
              }
            };

            worker.onerror = (err) => {
              // Worker failed to load - fall back to main thread
              console.warn('Worker failed, falling back to main thread:', err.message);
              worker.terminate();
              workerRef.current = null;

              try {
                const results = runSimulation(config, setProgress);
                setResults(results);
                saveScenario(results);
                resolve();
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Simulation failed';
                setError(msg);
                reject(e);
              }
            };

            worker.postMessage({ type: 'run_simulation', config });
          });
        } else {
          // No Worker support - run on main thread
          const results = runSimulation(config, setProgress);
          setResults(results);
          saveScenario(results);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Simulation failed';
        setError(msg);
        throw e;
      }
    },
    [setResults, setSimulating, setProgress, setError, saveScenario]
  );

  // Queue wrapper: multiple simulate() calls run sequentially instead of
  // the second one killing the first worker mid-flight
  const simulate = useCallback(
    (scenario: ScenarioOverrides = { name: 'Current Path' }) => {
      const p = queueRef.current.then(() => simulateOne(scenario)).catch(() => {});
      queueRef.current = p;
      return p;
    },
    [simulateOne]
  );

  return {
    simulate,
    currentResults,
    isSimulating,
    simulationProgress,
    error,
    savedScenarios,
    compareScenarios,
  };
}
