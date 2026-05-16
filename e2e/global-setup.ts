import { startMockConfluence } from './mock-confluence';

export default async function globalSetup(): Promise<void> {
  const { baseUrl } = await startMockConfluence();
  // Tests read this to know where the mock lives. Main process can also pick
  // it up if a future change wires LOOPBRIDGE_TEST_BASE_URL into config.
  process.env.LOOPBRIDGE_TEST_BASE_URL = baseUrl;
  console.log(`[e2e] mock Confluence listening at ${baseUrl}`);
}
