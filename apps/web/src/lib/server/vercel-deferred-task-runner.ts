import { waitUntil } from '@vercel/functions';
import type { DeferredTaskRunner } from '@eskwelabs-advisor/server';

export class VercelDeferredTaskRunner implements DeferredTaskRunner {
  run(task: () => Promise<void>): void {
    waitUntil(
      task().catch((error) => {
        console.error('conversation_title_deferred_task_failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      })
    );
  }
}
