/// <reference lib="webworker" />

import type { SimulationConfig, SimulationResults, WorkerRequest, WorkerResponse } from '@/lib/types';

// We need to import the engine inline since Web Workers have their own context
// The actual engine code is bundled by Next.js/webpack

import { runSimulation } from '@/lib/simulation/engine';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, config } = event.data;

  if (type === 'run_simulation') {
    try {
      const results = runSimulation(config, (progress) => {
        const response: WorkerResponse = {
          type: 'simulation_progress',
          progress,
        };
        self.postMessage(response);
      });

      const response: WorkerResponse = {
        type: 'simulation_complete',
        results,
      };
      self.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        type: 'simulation_error',
        error: error instanceof Error ? error.message : 'Simulation failed',
      };
      self.postMessage(response);
    }
  }
};

export {};
