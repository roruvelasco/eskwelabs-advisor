'use client';

import { ChevronUp, LogOut, Plus, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AppBrand,
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { conversationsQuery } from '@/lib/domains/conversations/queries';

function RecentConversationButton({
  conversation,
  onClick
}: {
  conversation: { id: string; title: string; advisorId: string };
  onClick: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onClick();
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={conversation.title}>
        <button type="button" onClick={handleClick}>
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {conversation.title}
          </span>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function ChatSidebar({
  currentAdvisorId,
  currentConversationId
}: {
  currentAdvisorId?: string;
  currentConversationId?: string;
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data, isError } = useQuery(conversationsQuery());

  const conversations = (data?.data ?? []) as Array<{
    id: string;
    title: string;
    advisorId: string;
  }>;
  const newChatAdvisorId =
    currentAdvisorId ??
    conversations.find(
      (conversation) => conversation.id === currentConversationId
    )?.advisorId;

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleNewChat = () => {
    closeMobileSidebar();
    router.push(
      newChatAdvisorId ? `/chat?advisor=${newChatAdvisorId}` : '/advisors'
    );
  };

  const handleAdvisorSelection = () => {
    closeMobileSidebar();
    router.push('/advisors');
  };

  const handleLogout = async () => {
    closeMobileSidebar();
    await fetch('/api/signout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <Sidebar id="chat-sidebar" collapsible="offcanvas" className="!border-r-0">
      <SidebarHeader className="gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand />
          <SidebarTrigger aria-label="Close sidebar" className="size-9" />
        </div>

        <Button
          variant="ghost"
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start gap-2 font-normal"
          type="button"
          onClick={handleNewChat}
        >
          <Plus size={15} aria-hidden="true" />
          New chat
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">
            Recents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isError ? (
              <p className="text-muted-foreground px-3 text-sm">
                Could not load conversations.
              </p>
            ) : conversations.length === 0 ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    disabled
                    className="text-muted-foreground cursor-default text-sm"
                  >
                    No recent conversations yet.
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <RecentConversationButton
                    key={conversation.id}
                    conversation={conversation}
                    onClick={() =>
                      router.push(`/chat?conversation=${conversation.id}`)
                    }
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="hover:bg-sidebar-accent h-auto w-full justify-between gap-2 px-2 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="size-8">
                  <AvatarFallback>MW</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground min-w-0 truncate text-sm font-normal">
                  Mentor workspace
                </span>
              </span>
              <ChevronUp className="text-muted-foreground size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onSelect={handleAdvisorSelection}>
              <UserRound className="size-4" />
              Advisor selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void handleLogout()}
            >
              <LogOut className="size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
