import { app } from 'electron';
import type { ConfluenceBackend } from '@shared/domain';
import type { PageStatus } from '@shared/types';
import {
  endRun as endRunDao,
  recordEvent as recordEventDao,
  startRun as startRunDao,
  transitionPage as transitionPageDao,
  upsertPage as upsertPageDao,
} from '@main/store/audit';
import { childLogger } from '@main/logging/logger';

const log = () => childLogger({ mod: 'progress' });

let currentRunId: number | undefined;

export async function ensureRun(input: {
  backend: ConfluenceBackend;
  spaceKey: string;
  baseUrl: string;
  userLabel?: string;
}): Promise<number> {
  if (currentRunId !== undefined) return currentRunId;
  const opts: {
    backend: ConfluenceBackend;
    spaceKey: string;
    baseUrl: string;
    appVersion: string;
    userLabel?: string;
  } = {
    backend: input.backend,
    spaceKey: input.spaceKey,
    baseUrl: input.baseUrl,
    appVersion: app.getVersion(),
  };
  if (input.userLabel) opts.userLabel = input.userLabel;
  currentRunId = startRunDao(opts);
  log().info({ runId: currentRunId }, 'audit run started');
  return currentRunId;
}

export function endCurrentRun(): void {
  if (currentRunId !== undefined) {
    endRunDao(currentRunId);
    currentRunId = undefined;
  }
}

export function getCurrentRunId(): number | undefined {
  return currentRunId;
}

export interface UpsertInput {
  pageId: string;
  spaceKey: string;
  title: string;
  versionNumber: number;
  parentId?: string;
}

export function upsertPageSummary(input: UpsertInput): void {
  const opts: {
    pageId: string;
    spaceKey: string;
    title: string;
    versionNumber: number;
    parentId?: string;
  } = {
    pageId: input.pageId,
    spaceKey: input.spaceKey,
    title: input.title,
    versionNumber: input.versionNumber,
  };
  if (input.parentId) opts.parentId = input.parentId;
  upsertPageDao(opts);
}

export interface TransitionInput {
  pageId: string;
  next: PageStatus;
  eventKind: string;
  eventOutcome?: 'success' | 'error' | 'retried';
  patch?: {
    needsReview?: number;
    imagesEmbedded?: number;
    imagesManual?: number;
    errorKind?: string;
    errorMessage?: string;
    note?: string;
  };
  details?: Record<string, unknown>;
}

export function transition(input: TransitionInput): void {
  const runId = currentRunId ?? -1;
  const opts: {
    runId: number;
    pageId: string;
    next: PageStatus;
    eventKind: string;
    eventOutcome?: 'success' | 'error' | 'retried';
    patch?: TransitionInput['patch'];
    details?: Record<string, unknown>;
  } = {
    runId,
    pageId: input.pageId,
    next: input.next,
    eventKind: input.eventKind,
  };
  if (input.eventOutcome) opts.eventOutcome = input.eventOutcome;
  if (input.patch) opts.patch = input.patch;
  if (input.details) opts.details = input.details;
  transitionPageDao(opts);
}

export function recordEvent(input: {
  pageId?: string;
  kind: string;
  outcome: 'success' | 'error' | 'retried';
  details?: Record<string, unknown>;
}): void {
  const runId = currentRunId ?? -1;
  const opts: {
    runId: number;
    pageId?: string;
    kind: string;
    outcome: 'success' | 'error' | 'retried';
    details?: Record<string, unknown>;
  } = { runId, kind: input.kind, outcome: input.outcome };
  if (input.pageId) opts.pageId = input.pageId;
  if (input.details) opts.details = input.details;
  recordEventDao(opts);
}
