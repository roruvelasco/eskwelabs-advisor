'use client';

import { useState } from 'react';
import {
  Container,
  GrainOverlay,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './chat-sidebar';
import { ChatComposer } from './chat-composer';
import { ChatMessages, type Message } from './chat-messages';

const HARDCODED_REPLY = `Great question! Let me break this down for you.

Eskwelabs follows a structured cohort-based learning model. Each sprint lasts two weeks, and you'll typically have a combination of synchronous sessions (live with your cohort and mentor) and asynchronous work (readings, notebooks, project deliverables).

Here's what a typical week looks like for a Data Science Fellow:

**Monday–Tuesday**: Concept introduction. Your mentor will walk through the week's topic — this sprint it might be feature engineering or model evaluation. Expect ~2–3 hours of live instruction spread across the two days.

**Wednesday–Thursday**: Hands-on sprint work. You'll apply what you learned on a real dataset. This is where most of the learning actually happens — don't skip the exploratory notebooks.

**Friday**: Sync checkpoint. A short standup with your pod (your small accountability group within the cohort). Share what you built, what you're stuck on, what you'll tackle next week.

**Weekend**: Catch-up buffer. Most fellows use this to polish deliverables or revisit concepts that didn't click yet. It's not mandatory, but the ones who use it consistently tend to have a much smoother capstone sprint.

For your specific situation — if you're balancing a day job — I'd recommend front-loading the async work early in the week so that by the time Friday's checkpoint arrives, you're not scrambling. The mentors are also available on Slack during office hours (check the cohort channel for the current schedule).

Is there a specific sprint topic you're preparing for, or are you trying to plan your overall schedule for the program?`;

function ChatLayout() {
  const { open, isMobile, openMobile } = useSidebar();
  const [messages, setMessages] = useState<Message[]>([]);

  const triggerHidden = isMobile ? openMobile : open;
  const hasMessages = messages.length > 0;

  const handleSend = (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text
    };
    const advisorMsg: Message = {
      id: crypto.randomUUID(),
      role: 'advisor',
      content: HARDCODED_REPLY
    };
    setMessages((prev) => [...prev, userMsg, advisorMsg]);
  };

  return (
    <>
      <ChatSidebar />

      <SidebarInset className="bg-background h-dvh overflow-hidden p-3">
        <GrainOverlay
          intensity="subtle"
          className="bg-card border-border flex h-full min-h-0 flex-col overflow-hidden rounded-xl border"
        >
          <header
            className={cn(
              'flex h-14 shrink-0 items-center px-4 transition-opacity duration-300 ease-in-out',
              triggerHidden
                ? 'pointer-events-none invisible opacity-0'
                : 'opacity-100'
            )}
          >
            <SidebarTrigger
              aria-controls="chat-sidebar"
              aria-label="Open sidebar"
              className="size-9"
            />
          </header>

          {hasMessages ? (
            <>
              <ChatMessages messages={messages} />
              <div className="border-border/50 shrink-0 border-t p-3">
                <ChatComposer onSend={handleSend} />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto">
              <Container className="motion-stagger-in flex flex-col items-center gap-6 px-4 py-12">
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-foreground text-balance font-serif text-4xl leading-[1.1] tracking-tight md:text-5xl">
                    Let&apos;s get to work, cohort fellow.
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Ask anything — your advisor is ready.
                  </p>
                </div>

                <ChatComposer onSend={handleSend} />
              </Container>
            </div>
          )}
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
