import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function AdminDashboard() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-4 px-6 py-10 md:grid-cols-2">
      {['Usage', 'Model config', 'Prompt cache', 'Telemetry'].map((section) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle>{section}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600">
              Admin {section.toLowerCase()} placeholder.
            </p>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
