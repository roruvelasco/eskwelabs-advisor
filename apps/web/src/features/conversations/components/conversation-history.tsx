import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function ConversationHistory() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Conversation history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600">
            User-owned conversation list placeholder.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
