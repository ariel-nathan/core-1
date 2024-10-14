import { useEffect, useState } from "react";
import {
  Pipeline,
  PipelineType,
  PretrainedOptions,
  Tensor,
} from "@xenova/transformers";

import { InitEventData, OutgoingEventData, RunEventData } from "./worker";

export type PipeParameters = Parameters<Pipeline["_call"]>;
export type PipeReturnType = Awaited<ReturnType<Pipeline["_call"]>>;
export type PipeFunction = (...args: PipeParameters) => Promise<PipeReturnType>;

const WORKER_COUNT = 10; // Number of workers in the pool

export function usePipeline(
  task: PipelineType,
  model?: string,
  options?: PretrainedOptions,
) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pipes, setPipes] = useState<PipeFunction[]>([]);

  useEffect(() => {
    const { progress_callback, ...transferableOptions } = options ?? {};
    const newWorkers: Worker[] = [];

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });

      const onMessageReceived = (e: MessageEvent<OutgoingEventData>) => {
        const { type } = e.data;

        switch (type) {
          case "progress": {
            const { data } = e.data;
            progress_callback?.(data);
            break;
          }
          case "ready": {
            newWorkers.push(worker);
            if (newWorkers.length === WORKER_COUNT) {
              setWorkers(newWorkers);
            }
            break;
          }
        }
      };

      worker.addEventListener("message", onMessageReceived);

      worker.postMessage({
        type: "init",
        args: [task, model, transferableOptions],
      } satisfies InitEventData);
    }

    return () => {
      newWorkers.forEach((worker) => {
        worker.terminate();
      });
      setWorkers([]);
    };
  }, [task, model, options]);

  useEffect(() => {
    if (workers.length !== WORKER_COUNT) {
      return;
    }

    const callbacksMap = new Map<
      Worker,
      Map<number, (data: PipeReturnType) => void>
    >();

    const onMessageReceived = (e: MessageEvent<OutgoingEventData>) => {
      switch (e.data.type) {
        case "result":
          const { id, data: serializedData } = e.data;
          const { type, data, dims } = serializedData;
          const output = new Tensor(type, data, dims);
          const worker = e.currentTarget as Worker;
          const callbacks = callbacksMap.get(worker);

          if (!callbacks) {
            throw new Error(`Missing callbacks map for worker`);
          }

          const callback = callbacks.get(id);

          if (!callback) {
            throw new Error(`Missing callback for pipe execution id: ${id}`);
          }

          callback(output);
          break;
      }
    };

    const newPipes: PipeFunction[] = workers.map((worker) => {
      let currentId = 0;
      const callbacks = new Map<number, (data: PipeReturnType) => void>();
      callbacksMap.set(worker, callbacks);

      worker.addEventListener("message", onMessageReceived);

      const pipe: PipeFunction = (...args) => {
        if (!worker) {
          throw new Error("Worker unavailable");
        }

        const id = currentId++;

        return new Promise<PipeReturnType>((resolve) => {
          callbacks.set(id, resolve);
          worker.postMessage({ type: "run", id, args } satisfies RunEventData);
        });
      };

      return pipe;
    });

    setPipes(newPipes);

    return () => {
      workers.forEach((worker) => {
        worker.removeEventListener("message", onMessageReceived);
      });
      setPipes([]);
    };
  }, [workers]);

  return pipes;
}
