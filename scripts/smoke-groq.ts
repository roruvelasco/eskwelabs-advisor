import { getServerEnv } from '../packages/server/src/config/env';
import { GroqLlmProvider } from '../packages/server/src/adapters/advisor-adapters';

async function main() {
  const env = getServerEnv();
  const provider = new GroqLlmProvider(env);

  console.log('=== smoke-groq ===\n');
  console.log(`Using API key: ${env.GROQ_API_KEY ? '✓ present' : '✗ missing'}`);
  console.log(`Using Base URL: ${env.GROQ_BASE_URL}\n`);

  console.log('Testing complete()...');

  try {
    const result = await provider.complete({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a concise, helpful assistant.' },
        { role: 'user', content: 'Say exactly: "Groq is working perfectly!"' }
      ]
    });

    console.log('\n✓ Success!');
    console.log('Response:', result.content);
    console.log(
      `Tokens:   ${result.promptTokens} prompt / ${result.completionTokens} completion`
    );
    console.log(`Latency:  ${result.latencyMs} ms`);
    console.log(`Cost:     $${result.estimatedCostUsd}`);
  } catch (error) {
    if (
      error != null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      'message' in error
    ) {
      console.error(
        `\n✗ HttpException [${(error as { statusCode: number }).statusCode}]: ${(error as { message: string }).message}`
      );
    } else {
      console.error('\n✗ Unexpected error:', error);
    }
    process.exit(1);
  }
}

main().catch(console.error);
