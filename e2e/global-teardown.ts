import { stopMockConfluence } from './mock-confluence';

export default async function globalTeardown(): Promise<void> {
  await stopMockConfluence();
}
