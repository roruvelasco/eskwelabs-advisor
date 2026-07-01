import { describe, expect, test } from 'bun:test';

describe('admin advisor management wiring', () => {
  test('admin dashboard exposes a dedicated advisors section', async () => {
    const source = await Bun.file(
      import.meta.dir + '/admin-dashboard.tsx'
    ).text();

    expect(source).toContain("'advisors'");
    expect(source).toContain('AdvisorManagementPanel');
    expect(source).toContain('CreateAdvisorButton');
  });

  test('advisor panel calls admin advisor CRUD and publish APIs', async () => {
    const source = await Bun.file(
      import.meta.dir + '/advisor-management-panel.tsx'
    ).text();

    expect(source).toContain('createAdvisor');
    expect(source).toContain('updateAdvisor');
    expect(source).toContain('deleteAdvisor');
    expect(source).toContain('publishAdvisor');
  });

  test('knowledge panel no longer owns advisor prompt source editing', async () => {
    const source = await Bun.file(
      import.meta.dir + '/knowledge-panel.tsx'
    ).text();

    expect(source).not.toContain('advisorPromptSourcesQuery');
    expect(source).not.toContain('updateAdvisorPromptSource');
    expect(source).not.toContain("'advisor_prompt'");
    expect(source).toContain('adminAdvisorsQuery');
  });

  test('model panel fetches providers from backend catalog', async () => {
    const source = await Bun.file(
      import.meta.dir + '/model-config-panel.tsx'
    ).text();

    expect(source).toContain('modelCatalogQuery');
    expect(source).not.toContain("PROVIDERS['gemini']");
    expect(source).not.toContain('PROVIDERS.gemini');
  });
});
