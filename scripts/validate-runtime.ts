import {
  createContainer,
  AdvisorRuntimeService,
  AdvisorsRepository
} from '@eskwelabs-advisor/server';

async function main() {
  const container = createContainer();
  const runtimeService = container.get(AdvisorRuntimeService);
  const advisorsRepository = container.get(AdvisorsRepository);

  const advisors = await advisorsRepository.list();
  let allReady = true;

  console.log('\nAdvisor runtime validation:\n');

  for (const advisor of advisors) {
    const result = await runtimeService.checkReadiness(advisor.id);
    if (result.ready) {
      console.log(`  ${advisor.id}\n    ✓ ready`);
    } else {
      allReady = false;
      console.log(`  ${advisor.id}`);
      for (const reason of result.reasons) {
        console.log(`    ✗ ${reason.code} — ${reason.message}`);
      }
    }
  }

  console.log('');
  if (!allReady) {
    console.error('Validation FAILED: some advisors are not runnable.');
    process.exit(1);
  }

  console.log('All advisors are ready.');
}

main().catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});
