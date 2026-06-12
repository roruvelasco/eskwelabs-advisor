'use client';

import { useState } from 'react';
import {
  ChevronUp,
  LogOut,
  Plus,
  UserRound,
  EllipsisVertical,
  Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AppBrand,
  Avatar,
  AvatarFallback,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  toast,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { deleteConversation } from '@/lib/domains/conversations/api';
import {
  conversationQuery,
  conversationsQuery
} from '@/lib/domains/conversations/queries';

type SidebarConversation = {
  id: string;
  userId: string;
  title: string;
  advisorId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function RecentConversationButton({
  conversation,
  isActive,
  onClick,
  onDelete
}: {
  conversation: SidebarConversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onClick();
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={conversation.title}
        isActive={isActive}
      >
        <button type="button" onClick={handleClick}>
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {conversation.title}
          </span>
        </button>
      </SidebarMenuButton>

      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            aria-label={`Options for ${conversation.title}`}
            className={!isActive ? 'hidden' : undefined}
          >
            <EllipsisVertical className="size-4" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDropdownOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function ChatSidebar({
  currentAdvisorId,
  currentConversationId,
  isResolvingConversationAdvisor = false
}: {
  currentAdvisorId?: string;
  currentConversationId?: string;
  isResolvingConversationAdvisor?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data, isError, isLoading } = useQuery({
    ...conversationsQuery(currentAdvisorId),
    enabled: Boolean(currentAdvisorId) && !isResolvingConversationAdvisor
  });

  const conversations = (data?.data ?? []) as SidebarConversation[];
  const newChatAdvisorId =
    currentAdvisorId ??
    conversations.find(
      (conversation) => conversation.id === currentConversationId
    )?.advisorId;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries(conversationsQuery(currentAdvisorId));
      queryClient.removeQueries({
        queryKey: conversationQuery(deletedId).queryKey
      });
      toast.success('Conversation deleted');
      if (currentConversationId === deletedId) {
        router.push(
          newChatAdvisorId ? `/chat?advisor=${newChatAdvisorId}` : '/advisors'
        );
      }
    },
    onError: () => {
      toast.error('Failed to delete conversation');
    }
  });

  const handleDeleteConfirm = () => {
    if (!pendingDeleteId) return;
    const idToDelete = pendingDeleteId;
    setPendingDeleteId(null);
    deleteMutation.mutate(idToDelete);
  };

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

  const handleConversationSelection = (conversation: SidebarConversation) => {
    queryClient.setQueryData(conversationQuery(conversation.id).queryKey, {
      data: conversation
    });
    router.push(`/chat?conversation=${conversation.id}`);
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
            {isResolvingConversationAdvisor || isLoading ? (
              <p className="text-muted-foreground px-3 text-sm">
                Loading conversations...
              </p>
            ) : isError ? (
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
                    isActive={conversation.id === currentConversationId}
                    onClick={() => handleConversationSelection(conversation)}
                    onDelete={() => setPendingDeleteId(conversation.id)}
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

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This conversation and all its messages will be permanently
              deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeleteId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
