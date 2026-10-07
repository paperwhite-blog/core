import { shortHash } from './text.ts';

export function previewUrl(id: string): string {
  return `/_pw/previews/${shortHash(id)}.json`;
}
