'use client';
import { CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator
} from '@eskwelabs-advisor/ui';

const NOTICE_ITEMS = [
  ['Performance analysis', 'Understanding how advisors help EIFs'],
  ['Quality improvement', 'Refining prompts, system design, and models'],
  ['Usage monitoring', 'Tracking token counts and API costs'],
  ['Safety', 'Detecting and preventing misuse']
] as const;

export interface ConsentDialogProps {
  open: boolean;
  acknowledged: boolean;
  isAcknowledging: boolean;
  error?: string;
  onAcknowledge: () => void;
}

export function ConsentDialog({
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
          <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
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
            <DialogHeader className="space-y-2 px-6 pt-6">
              <Badge
                variant="outline"
                className="border-border text-muted-foreground w-fit text-[10px] font-normal uppercase tracking-widest"
              >
                Notice
              </Badge>
              <DialogTitle className="text-foreground font-serif text-2xl leading-tight tracking-tight">
                Monitoring &amp; Logging Notice
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                Before you continue, please read the following carefully.
              </DialogDescription>
            </DialogHeader>

            <div className="text-muted-foreground space-y-4 px-6 py-5 text-sm">
              <p>
                <span className="text-foreground font-medium">
                  Your conversations are logged and monitored.
                </span>{' '}
                Eskwelabs Advisor records all interactions for:
              </p>

              <ul className="space-y-2.5 pl-1">
                {NOTICE_ITEMS.map(([label, detail]) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <span className="bg-muted-foreground/40 mt-[7px] size-1 shrink-0 rounded-full" />
                    <span>
                      <span className="text-foreground font-medium">{label}:</span>{' '}
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

              <p className="text-muted-foreground text-sm leading-relaxed">
                By continuing, you acknowledge that your conversations with
                Eskwelabs Advisor may be stored, analyzed, and used for platform
                improvement.
              </p>

              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            <DialogFooter className="bg-muted/30 border-t px-6 py-4">
              <Button
                size="lg"
                className="w-full"
                onClick={onAcknowledge}
                disabled={isAcknowledging}
              >
                {isAcknowledging ? 'Acknowledging…' : 'I Acknowledge and Continue'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}