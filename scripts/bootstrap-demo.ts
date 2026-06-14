import {
  createContainer,
  CompiledSystemPromptBuilder,
  AdvisorRuntimeVersionRepository,
  AdvisorsRepository,
  PromptSnapshotsRepository,
  DnaDigestsRepository,
  ModelConfigRepository
} from '@eskwelabs-advisor/server';

async function main() {
  const container = createContainer();
  const advisorsRepo = container.get(AdvisorsRepository);
  const runtimeRepo = container.get(AdvisorRuntimeVersionRepository);
  const snapshotsRepo = container.get(PromptSnapshotsRepository);
  const digestsRepo = container.get(DnaDigestsRepository);
  const modelConfigRepo = container.get(ModelConfigRepository);
  const promptBuilder = container.get(CompiledSystemPromptBuilder);

  const advisors = await advisorsRepo.list();
  if (advisors.length === 0) {
    console.log('No advisors found. Run db:sync-advisors first.');
    process.exit(0);
  }

  for (const advisor of advisors) {
    console.log(`\nBootstrapping: ${advisor.id} (${advisor.name})`);

    const existingRuntime = await runtimeRepo.findActiveForAdvisor(advisor.id);
    if (existingRuntime) {
      console.log(
        `  ✓ already has published runtime version ${existingRuntime.versionNumber}`
      );
      continue;
    }

    if (!advisor.promptDocId) {
      console.log(`  ✗ ${advisor.id} has no promptDocId, skipping`);
      continue;
    }

    let snapshotId: string | null = null;
    let digestId: string | null = null;

    const existingSnapshot = await snapshotsRepo.findActive(advisor.id);
    if (existingSnapshot) {
      snapshotId = existingSnapshot.id;
      console.log(
        `  ✓ using existing prompt snapshot ${existingSnapshot.hash.slice(0, 8)}`
      );
    } else {
      const compiled = promptBuilder.build({
        advisorPromptText: `System instructions for ${advisor.id}`,
        dnaDigestText: 'DNA digest for all advisors'
      });
      const snapshot = await snapshotsRepo.createActive({
        advisorId: advisor.id,
        docId: advisor.promptDocId ?? `${advisor.id}-demo-doc`,
        revision: 'demo-revision',
        contentText: compiled.text,
        hash: compiled.hash
      });
      snapshotId = snapshot.id;
      console.log(
        `  ✓ created demo prompt snapshot ${snapshot.hash.slice(0, 8)}`
      );
    }

    const existingDigest = await digestsRepo.findActive();
    if (existingDigest) {
      digestId = existingDigest.id;
      console.log(
        `  ✓ using existing DNA digest ${existingDigest.hash.slice(0, 8)}`
      );
    } else {
      const digest = await digestsRepo.createActive({
        docId: 'demo-dna-doc',
        revision: 'demo-revision',
        sourceHash: 'demo-source-hash',
        digestText: 'DNA digest for all advisors',
        hash: 'demo-dna-hash-v1'
      });
      digestId = digest.id;
      console.log(`  ✓ created demo DNA digest ${digest.hash.slice(0, 8)}`);
    }

    const modelConfig = await modelConfigRepo.find(advisor.id);
    if (!modelConfig) {
      console.log(`  ✗ no model config for ${advisor.id}, skipping`);
      continue;
    }

    const version = await runtimeRepo.create({
      advisorId: advisor.id,
      promptSnapshotId: snapshotId,
      dnaDigestId: digestId,
      modelConfigAdvisorId: modelConfig.advisorId,
      versionNumber: 1,
      status: 'published',
      publishedAt: new Date(),
      publishedBy: undefined
    });

    await runtimeRepo.setAdvisorActiveVersion(advisor.id, version.id);
    console.log(
      `  ✓ published runtime version ${version.versionNumber} (${version.id.slice(0, 8)})`
    );
  }

  console.log('\nDemo bootstrap complete.');
}

main().catch((error) => {
  console.error('Bootstrap error:', error);
  process.exit(1);
});
