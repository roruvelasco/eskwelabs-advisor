import Link from 'next/link';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">Eskwelabs Advisor</p>
        <h1 className="text-3xl font-semibold tracking-normal">
          Internal advisor skeleton
        </h1>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Advisors', '/advisors'],
          ['Chat', '/chat'],
          ['Admin', '/admin']
        ].map(([label, href]) => (
          <Card key={href}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
