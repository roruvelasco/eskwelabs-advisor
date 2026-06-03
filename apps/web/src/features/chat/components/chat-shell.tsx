import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function ChatShell() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <h1 className="text-xl font-semibold">Chat</h1>
        <p className="text-sm text-zinc-600">
          Conversation metadata and advisor context go here.
        </p>
      </aside>
      <Card className="min-h-[640px]">
        <CardHeader>
          <CardTitle>Advisor thread</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[540px] flex-col justify-between gap-4">
          <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
            Streaming messages will render here.
          </div>
          <form className="flex gap-2">
            <input
              className="h-9 flex-1 rounded-md border border-zinc-200 px-3 text-sm"
              placeholder="Message placeholder"
            />
            <Button type="button">Send</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
