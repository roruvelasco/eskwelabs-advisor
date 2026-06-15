import { describe, expect, test } from 'bun:test';

describe('chat sidebar', () => {
  test('loads recents for the current advisor only after advisor resolution', async () => {
    const source = await Bun.file(import.meta.dir + '/chat-sidebar.tsx').text();

    expect(source).toContain(
      'conversationsQuery({ advisorId: currentAdvisorId })'
    );
    expect(source).toContain('enabled: Boolean(currentAdvisorId)');
    expect(source).toContain('!isResolvingConversationAdvisor');
  });

  test('seeds selected conversation detail before sidebar navigation', async () => {
    const source = await Bun.file(import.meta.dir + '/chat-sidebar.tsx').text();

    expect(source).toContain('useQueryClient');
    expect(source).toContain('queryClient.setQueryData');
    expect(source).toContain('conversationQuery(conversation.id).queryKey');
    expect(source).toContain(
      'router.push(`/chat?conversation=${conversation.id}`)'
    );
  });

  test('chat shell keeps a stable sidebar advisor during route transitions', async () => {
    const source = await Bun.file(
      import.meta.dir + '/new-chat-shell.tsx'
    ).text();

    expect(source).toContain('stableSidebarAdvisorId');
    expect(source).toContain('setStableSidebarAdvisorId(currentAdvisorId)');
    expect(source).toContain(
      'const sidebarAdvisorId = currentAdvisorId ?? stableSidebarAdvisorId'
    );
    expect(source).toContain('Boolean(conversationId) && !sidebarAdvisorId');
  });
});
