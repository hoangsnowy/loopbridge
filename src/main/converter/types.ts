import type { AttachmentInfo } from '@shared/domain';
import type { ImagePlanEntry } from '@shared/types';

export interface ConvertContext {
  baseUrl: string;
  spaceKey: string;
  attachments: AttachmentInfo[];
  imageStrategy: 'auto' | 'base64' | 'manual';
  base64MaxBytesPerImage: number;
  base64MaxBytesPerPage: number;
  demoteH1ToH2: boolean;
  rewriteInternalLinks: 'keep-confluence' | 'placeholder';
  needsReviewMarker: boolean;
  jiraBase?: string;
  loadAttachment?: (filename: string) => Promise<Buffer | null>;
  attachmentLocalPath?: (filename: string) => string | undefined;
}

export interface ConvertState {
  needsReview: number;
  imagesEmbedded: number;
  imagesManual: number;
  imagePlan: ImagePlanEntry[];
  base64BytesUsed: number;
}

export interface ConvertOutput {
  html: string;
  needsReview: number;
  imagesEmbedded: number;
  imagesManual: number;
  imagePlan: ImagePlanEntry[];
}

export function emptyState(): ConvertState {
  return {
    needsReview: 0,
    imagesEmbedded: 0,
    imagesManual: 0,
    imagePlan: [],
    base64BytesUsed: 0,
  };
}
