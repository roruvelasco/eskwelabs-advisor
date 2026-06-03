export class MessagesSerializer {
  list(rows: unknown[]) {
    return { data: rows };
  }
}
