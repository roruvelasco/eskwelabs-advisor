import Link from 'next/link';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

const advisors = [
  { id: 'data-dashboard', name: 'Data Dashboard Advisor' },
  { id: 'ssot-memo', name: 'SSOT Memo Advisor' },
  { id: 'advisor-3', name: 'Advisor 3' }
];

export function AdvisorSelection() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Choose an advisor</h1>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {advisors.map((advisor) => (
          <Card key={advisor.id}>
            <CardHeader>
              <CardTitle>{advisor.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={`/chat?advisor=${advisor.id}`}>Open chat</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
