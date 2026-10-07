import type { VFile } from 'vfile';
import type { ResolvedConfig } from '../config.ts';
import type { VaultIndex, IndexedNote } from '../content/vault-index.ts';
import type { ImageOptions } from '../content/images.ts';
import type { FaqItem, Heading, PaperwhitePlugin, UnresolvedLink } from '../types.ts';

export interface RenderContext {
  index: VaultIndex;
  note: IndexedNote;
  config: ResolvedConfig;
  plugins: PaperwhitePlugin[];
  imageOptions: ImageOptions;
  /** transclusion stack (note ids) for recursion guarding */
  stack: string[];
  /** `![[note#section]]` — heading text or ^block id to slice to */
  section?: string;
  /** true when rendering inside a transclusion */
  embedded: boolean;
  /** Render another note for transclusion */
  renderEmbed: (target: IndexedNote, section: string | undefined, stack: string[]) => Promise<string>;
  /** Static link-preview JSON URL for a note */
  previewUrl: (note: IndexedNote) => string;
  // ---- collected output ----
  unresolved: UnresolvedLink[];
  outgoing: Set<string>;
  faq: FaqItem[];
  imagesMissingAlt: string[];
  images: string[];
  /** public URL → file, assets used by this note */
  assets: Record<string, string>;
  headings: Heading[];
  text: string;
  firstParagraph: string;
}

export function ctxOf(file: VFile): RenderContext {
  const ctx = (file.data as { pw?: RenderContext }).pw;
  if (!ctx) throw new Error('PaperWhite pipeline: missing render context on vfile.data.pw');
  return ctx;
}
