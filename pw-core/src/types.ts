import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot, Element } from 'hast';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface ImageInfo {
  src: string;
  width: number;
  height: number;
  /** srcset per format */
  sources: { type: string; srcset: string }[];
  /** fallback srcset in the original format */
  srcset: string;
  alt?: string;
  /** public URL → file on disk, for the asset registry */
  assets?: Record<string, string>;
}

export interface LinkRef {
  id: string;
  title: string;
  url: string;
  excerpt?: string;
}

export interface Comment {
  id: string;
  parent?: string | null;
  author: string;
  url?: string;
  date: string;
  html: string;
}

export interface FaqItem {
  question: string;
  answerHtml: string;
  answerText: string;
}

export interface UnresolvedLink {
  source: string;
  target: string;
  line?: number;
}

/** Everything stored for a note in the content layer. */
export interface NoteData {
  type: 'post' | 'page';
  title: string;
  description: string;
  /** true when description was derived automatically */
  autoDescription: boolean;
  date?: Date;
  updated?: Date;
  slug: string;
  url: string;
  path: string;
  aliases: string[];
  tags: string[];
  categories: string[];
  series?: string;
  seriesOrder?: number;
  lang: string;
  dir: 'ltr' | 'rtl';
  cover?: ImageInfo;
  coverAlt?: string;
  authors: string[];
  draft: boolean;
  canonical?: string;
  noindex: boolean;
  toc: boolean;
  math: boolean;
  cssclasses: string[];
  redirectFrom: string[];
  comments: Comment[];
  commentsEnabled: boolean;
  translations: Record<string, string>;
  /** Resolved translation URLs keyed by locale */
  alternates: Record<string, string>;
  headings: Heading[];
  wordCount: number;
  readingTime: number;
  excerpt: string;
  outgoing: string[];
  backlinks: LinkRef[];
  related: LinkRef[];
  faq: FaqItem[];
  imagesMissingAlt: string[];
  unresolved: UnresolvedLink[];
  images: string[];
  /** Plain text for llms.txt and previews */
  text: string;
  /** public URL → file on disk (images, attachments) used by this note */
  assets: Record<string, string>;
  /** digest of everything that affects the rendered HTML */
  digest: string;
  extra: Record<string, unknown>;
}

export interface EmbedContext {
  /** path of the target file relative to the vault */
  target: string;
  absPath: string;
  alias?: string;
  width?: number;
  height?: number;
}

export interface PaperwhitePlugin {
  name: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  /** Handle `![[file.ext]]` embeds by extension (without dot). Returns HTML. */
  embeds?: Record<string, (ctx: EmbedContext) => Promise<string> | string>;
  /** Handle fenced code blocks by language. Returns HTML or null to fall through. */
  fences?: Record<string, (code: string, meta: string | null) => Promise<string | null> | string | null>;
}

export type { MdastRoot, HastRoot, Element };

export type SerializedConfig = ReturnType<typeof import('./config.ts').serializableConfig>;

export interface ThemeManifest {
  name: string;
  themeApi: number;
  version?: string;
  description?: string;
  rtl: 'full' | 'tokens-only';
  fonts?: { latin?: string; rtl?: string; mono?: string };
  layouts?: string[];
  tokens?: Record<string, string>;
  i18n?: Record<string, Record<string, string>>;
  toc?: boolean;
}
