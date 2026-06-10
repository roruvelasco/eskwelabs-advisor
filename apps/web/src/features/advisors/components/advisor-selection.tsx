'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator
} from '@eskwelabs-advisor/ui';

import { acknowledgeConsent, getConsent } from '@/lib/domains/auth/api';
import { advisorsQuery } from '@/lib/domains/advisors/queries';

export function AdvisorSelection() {
  const [consentOpen, setConsentOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const {
    data: advisorsResponse,
    isLoading,
    isError
  } = useQuery(advisorsQuery);
  const advisors = advisorsResponse?.data ?? [];

  useEffect(() => {
    getConsent()
      .then((data) => {
        if (!data?.consentedAt) setConsentOpen(true);
      })
      .catch(() => setConsentOpen(true));
  }, []);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await acknowledgeConsent();
      setAcknowledged(true);
      setTimeout(() => setConsentOpen(false), 1100);
    } catch {
      setIsAcknowledging(false);
    }
  };

  return (
    <>
      <Dialog open={consentOpen} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          {acknowledged ? (
            <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 px-8 py-12 text-center duration-300">
              <div className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
                <CheckCircle2
                  className="text-primary size-7"
                  strokeWidth={1.5}
                />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-serif text-xl font-medium tracking-tight">
                  You&apos;re all set
                </p>
                <p className="text-muted-foreground text-sm">
                  Your acknowledgement has been recorded.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-primary/5 border-b px-6 py-5">
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary text-[10px] uppercase tracking-widest"
                    >
                      Notice
                    </Badge>
                  </div>
                  <DialogTitle className="text-foreground mt-2 font-serif text-2xl leading-tight tracking-tight">
                    Monitoring & Logging Notice
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                    Before you continue, please read the following carefully.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="text-muted-foreground space-y-4 px-6 py-5 text-sm">
                <p>
                  <span className="text-foreground font-medium">
                    Your conversations are logged and monitored.
                  </span>{' '}
                  Eskwelabs Advisor records all interactions for:
                </p>

                <ul className="space-y-2 pl-1">
                  {[
                    [
                      'Performance analysis',
                      'Understanding how advisors help EIFs'
                    ],
                    [
                      'Quality improvement',
                      'Refining prompts, system design, and models'
                    ],
                    ['Usage monitoring', 'Tracking token counts and API costs'],
                    ['Safety', 'Detecting and preventing misuse']
                  ].map(([label, detail]) => (
                    <li key={label} className="flex items-start gap-2.5">
                      <span className="bg-primary/60 mt-[5px] size-1.5 shrink-0 rounded-full" />
                      <span>
                        <span className="text-foreground font-medium">
                          {label}:
                        </span>{' '}
                        {detail}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="text-muted-foreground/70 text-xs">
                  Admin users can access usage analytics and logs. EIFs can
                  access only their own conversations and history.
                </p>

                <Separator />

                <p className="rounded-md border-l-4 border-amber-400 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  By continuing, you acknowledge that your conversations with
                  Eskwelabs Advisor may be stored, analyzed, and used for
                  platform improvement.
                </p>
              </div>

              <DialogFooter className="bg-muted/30 border-t px-6 py-4">
                <Button
                  size="lg"
                  className="motion-lift motion-press w-full"
                  onClick={handleAcknowledge}
                  disabled={isAcknowledging}
                >
                  {isAcknowledging
                    ? 'Acknowledging…'
                    : 'I Acknowledge and Continue'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
        <header>
          <h1 className="text-foreground font-serif text-3xl leading-tight tracking-tight">
            Choose an advisor
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select the advisor you want to work with today.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            <Card className="md:col-span-3">
              <CardContent className="text-muted-foreground py-8 text-sm">
                Loading advisors...
              </CardContent>
            </Card>
          ) : isError ? (
            <Card className="md:col-span-3">
              <CardContent className="text-muted-foreground py-8 text-sm">
                Could not load advisors.
              </CardContent>
            </Card>
          ) : advisors.length === 0 ? (
            <Card className="md:col-span-3">
              <CardContent className="text-muted-foreground py-8 text-sm">
                No advisors are available.
              </CardContent>
            </Card>
          ) : (
            advisors.map((advisor) => (
              <Card
                key={advisor.id}
                className="motion-lift transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    {advisor.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="motion-press">
                    <Link href={`/chat?advisor=${advisor.id}`}>Open chat</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>
    </>
  );
}
