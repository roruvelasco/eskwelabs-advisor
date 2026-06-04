'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function ConsentNotice() {
  const router = useRouter();
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      const response = await fetch('/api/consent', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to acknowledge consent');
      }

      router.push('/advisors');
    } catch (error) {
      console.error('Error acknowledging consent:', error);
      setIsAcknowledging(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Monitoring & Logging Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm text-zinc-700">
            <p>
              <strong>Your conversations are logged and monitored.</strong>
            </p>
            <p>
              Eskwelabs Advisor records all interactions for the following
              purposes:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm">
              <li>
                <strong>Performance analysis:</strong> Understanding how
                advisors help EIFs
              </li>
              <li>
                <strong>Quality improvement:</strong> Refining prompts, system
                design, and models
              </li>
              <li>
                <strong>Usage monitoring:</strong> Tracking token counts and API
                costs
              </li>
              <li>
                <strong>Safety:</strong> Detecting and preventing misuse
              </li>
            </ul>
            <p>
              Admin users can access usage analytics and logs. EIFs can access
              only their own conversations and history.
            </p>
            <p className="border-l-4 border-amber-200 bg-amber-50 p-3">
              By continuing, you acknowledge that your conversations with
              Eskwelabs Advisor may be stored, analyzed, and used for platform
              improvement.
            </p>
          </div>
          <Button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="w-full"
            size="lg"
          >
            {isAcknowledging
              ? 'Acknowledging...'
              : 'I Acknowledge and Continue'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
