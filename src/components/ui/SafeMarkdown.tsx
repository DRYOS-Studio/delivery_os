import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils/cn";

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
  },
};

type SafeMarkdownProps = {
  source: string;
  className?: string;
};

/**
 * Markdown sanitizado (headings, listas, ênfase, links, code inline).
 * Sem HTML bruto nem scripts — adequado para escopo de produto no catálogo admin.
 */
export function SafeMarkdown({
  source,
  className,
}: SafeMarkdownProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "font-body text-sm text-ink-soft leading-relaxed",
        "[&_h1]:font-display [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-ink [&_h1]:mt-6 [&_h1]:mb-2 [&_h1:first-child]:mt-0",
        "[&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-5 [&_h2]:mb-2",
        "[&_h3]:font-body [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:mt-4 [&_h3]:mb-1.5",
        "[&_p]:mb-3 [&_p:last-child]:mb-0",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1",
        "[&_li]:text-ink-soft",
        "[&_a]:text-oak [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_strong]:text-ink",
        "[&_code]:font-mono [&_code]:text-xs [&_code]:bg-card [&_code]:px-1 [&_code]:rounded",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
      >
        {source}
      </Markdown>
    </div>
  );
}