export class TelemetrySerializer {
  list(rows: unknown[]) {
    return { data: rows };
  }
}
