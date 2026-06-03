export class ApplicationModule {
  async start() {
    // Hook future providers here: database, cache, telemetry sinks, workers.
  }

  async stop() {
    // Close long-lived resources here when a non-serverless runtime needs it.
  }
}
