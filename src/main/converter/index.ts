import { runPipeline } from './cheerio-pipeline';
import { sanitize } from './sanitize';
import { emptyState, type ConvertContext, type ConvertOutput } from './types';

export type { ConvertContext, ConvertOutput } from './types';

export async function convertStorageToHtml(
  xhtml: string,
  ctx: ConvertContext,
): Promise<ConvertOutput> {
  const state = emptyState();
  const raw = await runPipeline(xhtml, ctx, state);
  const clean = sanitize(raw);
  return {
    html: clean,
    needsReview: state.needsReview,
    imagesEmbedded: state.imagesEmbedded,
    imagesManual: state.imagesManual,
    imagePlan: state.imagePlan,
  };
}
