export interface DeferredTaskRunner {
  run(task: () => Promise<void>): void;
}

export class ImmediateDeferredTaskRunner implements DeferredTaskRunner {
  run(task: () => Promise<void>): void {
    task().catch((error) => {
      console.error('conversation_title_deferred_task_failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }
}
