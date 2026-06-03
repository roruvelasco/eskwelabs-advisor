import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function LoginPanel() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600">
            Google OAuth and allow-list checks will be wired here.
          </p>
          <Button type="button">Continue with Google</Button>
        </CardContent>
      </Card>
    </main>
  );
}
