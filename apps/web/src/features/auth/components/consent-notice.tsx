import Link from 'next/link';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function ConsentNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usage notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600">
            Consent copy and persistence will be implemented later.
          </p>
          <Button asChild>
            <Link href="/advisors">Acknowledge</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
