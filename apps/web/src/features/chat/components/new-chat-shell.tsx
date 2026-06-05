'use client';

import {
  Container,
  GrainOverlay,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Stack,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './chat-sidebar';
import { ChatComposer } from './chat-composer';
import { ChatModeChips } from './chat-mode-chips';

function ChatLayout() {
  const { open } = useSidebar();

  return (
    <>
      <ChatSidebar />

      <SidebarInset className="h-dvh overflow-hidden">
        <GrainOverlay
          intensity="subtle"
          className="bg-background flex min-h-0 flex-1 flex-col"
        >
          <header
            className={cn(
              'flex h-14 shrink-0 items-center px-4 transition-opacity duration-300 ease-in-out',
              open ? 'pointer-events-none invisible opacity-0' : 'opacity-100'
            )}
          >
            <SidebarTrigger
              aria-controls="chat-sidebar"
              aria-label="Open sidebar"
              className="size-9"
            />
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto">
            <Container className="motion-stagger-in flex flex-col items-center gap-8 px-4 py-12">
              <Stack gap={3} className="items-center text-center">
                <Stack gap={2} className="items-center text-center">
                  <h1 className="text-foreground text-balance font-serif text-4xl leading-[1.1] tracking-tight md:text-5xl">
                    Let's get to work, cohort fellow.
                  </h1>
                </Stack>
              </Stack>

              <ChatComposer />

              <ChatModeChips />
            </Container>
          </div>
        </GrainOverlay>
      </SidebarInset>
    </>
  );
}

export function NewChatShell() {
  return (
    <SidebarProvider defaultOpen className="h-dvh min-h-0 overflow-hidden">
      <ChatLayout />
    </SidebarProvider>
  );
}
