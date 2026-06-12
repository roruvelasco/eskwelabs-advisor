'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Container,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  DotWave
} from '@eskwelabs-advisor/ui';

import { acknowledgeConsent, getConsent } from '@/lib/domains/auth/api';
import { advisorsQuery } from '@/lib/domains/advisors/queries';
import { getAdvisorMeta } from '@/lib/domains/advisors/meta';

// ─── AdvisorCard ──────────────────────────────────────────────────────────────

interface AdvisorCardProps {
  id: string;
  name: string;
  description: string;
  index: number;
}

function AdvisorCard({ id, name, description, index }: AdvisorCardProps) {
  const meta = getAdvisorMeta(id);
  const Icon = meta.icon;

  return (
    <div className="border-border/50 bg-card group flex flex-col rounded-2xl border p-8 transition-colors duration-200 hover:border-[#1a4a35]">
      {/* Ordinal */}
      <p className="text-muted-foreground/20 select-none font-serif text-6xl font-medium leading-none transition-colors duration-300 group-hover:text-[#2d6a4f]/35">
        {String(index + 1).padStart(2, '0')}
      </p>

      {/* Name + description — flex-1 so it absorbs all slack above the icon */}
      <div className="mt-6 flex-1 space-y-2">
        <p className="text-foreground font-serif text-xl font-medium leading-snug tracking-tight">
          {name}
        </p>
        <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
          {description ?? 'Advisor workspace'}
        </p>
      </div>

      {/* Icon — fixed-height slot, always at the same position */}
      <div className="flex h-32 items-center justify-center">
        <Icon
          className="text-muted-foreground/20 transition-colors duration-300 group-hover:text-[#2d6a4f]/40"
          size={52}
          strokeWidth={1.1}
        />
      </div>

      {/* Focus area — fixed-height block so the button is always aligned */}
      <div className="border-border/40 border-t pt-6">
        <p className="text-muted-foreground/45 mb-3 text-[10px] uppercase tracking-widest">
          Focus area
        </p>
        <p className="text-foreground/60 line-clamp-4 min-h-[5.75rem] text-sm leading-relaxed">
          {meta.focusArea}
        </p>
      </div>

      {/* CTA */}
      <Button
        asChild
        className="mt-7 w-full border-0 bg-[#4a8a69] text-white hover:bg-[#3a7259] focus-visible:ring-[#4a8a69]/50"
      >
        <Link href={`/chat?advisor=${id}`}>New Chat</Link>
      </Button>
    </div>
  );
}

// ─── ConsentDialog ────────────────────────────────────────────────────────────

const consentSessionKey = 'eskwelabs-advisor:monitoring-notice-seen';

interface ConsentDialogProps {
  open: boolean;
  acknowledged: boolean;
  isAcknowledging: boolean;
  error?: string;
  onAcknowledge: () => void;
}

function ConsentDialog({
  open,
  acknowledged,
  isAcknowledging,
  error,
  onAcknowledge
}: ConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {acknowledged ? (
          <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 px-8 py-12 text-center duration-300">
            <div className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="text-primary size-7" strokeWidth={1.5} />
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
                  Monitoring &amp; Logging Notice
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
                Admin users can access usage analytics and logs. EIFs can access
                only their own conversations and history.
              </p>

              <Separator />

              <p className="rounded-md border-l-4 border-amber-400 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                By continuing, you acknowledge that your conversations with
                Eskwelabs Advisor may be stored, analyzed, and used for platform
                improvement.
              </p>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            <DialogFooter className="bg-muted/30 border-t px-6 py-4">
              <Button
                size="lg"
                className="motion-lift motion-press w-full"
                onClick={onAcknowledge}
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
  );
}

// ─── AdvisorSelection (page) ──────────────────────────────────────────────────

export function AdvisorSelection() {
  const [consentOpen, setConsentOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consentError, setConsentError] = useState<string>();
  const {
    data: advisorsResponse,
    isLoading,
    isError
  } = useQuery(advisorsQuery);
  const { data: consentResponse, isLoading: isConsentLoading } = useQuery({
    queryKey: ['consent'],
    queryFn: getConsent
  });
  const advisors = advisorsResponse?.data ?? [];

  useEffect(() => {
    if (isConsentLoading) return;
    const consentedAt = (
      consentResponse as { consentedAt?: string | null } | undefined
    )?.consentedAt;

    if (!consentedAt) {
      setConsentOpen(true);
      return;
    }

    setConsentOpen(false);
    try {
      window.sessionStorage.setItem(consentSessionKey, 'true');
    } catch {
      return;
    }
  }, [consentResponse, isConsentLoading]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setConsentError(undefined);
    try {
      await acknowledgeConsent();
    } catch (error) {
      void error;
      setConsentError('Could not record acknowledgement. Please try again.');
      setIsAcknowledging(false);
      return;
    }

    try {
      window.sessionStorage.setItem(consentSessionKey, 'true');
    } catch (error) {
      void error;
    }

    try {
      setAcknowledged(true);
      setTimeout(() => setConsentOpen(false), 1100);
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <>
      <ConsentDialog
        open={consentOpen}
        acknowledged={acknowledged}
        isAcknowledging={isAcknowledging}
        error={consentError}
        onAcknowledge={handleAcknowledge}
      />

      <Container as="main" className="flex min-h-dvh flex-col py-16 md:py-24">
        <div className="mb-16 text-center">
          <h1 className="text-foreground font-serif text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Choose your advisor
          </h1>
        </div>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-32">
            <DotWave size={40} speed={1} color="#4a8a69" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-32">
            <p className="text-muted-foreground text-sm">
              Could not load advisors.
            </p>
          </div>
        ) : advisors.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-32">
            <p className="text-muted-foreground text-sm">
              No advisors are available.
            </p>
          </div>
        ) : (
          <div className="grid flex-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {advisors.map((advisor, index) => (
              <AdvisorCard
                key={advisor.id}
                id={advisor.id}
                name={advisor.name}
                description={advisor.description}
                index={index}
              />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
