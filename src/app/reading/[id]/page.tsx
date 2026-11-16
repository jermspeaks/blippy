import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getReadingItem } from "@/actions/reading";
import { ReaderActions } from "@/components/reader-actions";
import { ReaderShell } from "@/components/reader-shell";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getReadingItem(id);
  if (!item) notFound();

  const meta = [
    item.siteName,
    item.byline,
    item.readingMinutes ? `${item.readingMinutes} min read` : null,
  ].filter(Boolean);

  return (
    <div className="px-6 py-8">
      <ReaderShell
        itemId={item.id}
        status={item.status}
        initialPct={item.scrollPct}
      >
        <p className="mb-4 text-sm">
          <Link
            href="/reading"
            className="text-muted-foreground hover:underline"
          >
            ← Reading
          </Link>
        </p>
        <header className="mb-6 space-y-3">
          <h1 className="text-3xl leading-tight font-semibold">{item.title}</h1>
          {meta.length > 0 && (
            <p className="text-muted-foreground text-sm">{meta.join(" · ")}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
            >
              <ExternalLink className="size-3" />
              Open original
            </a>
            <ReaderActions
              id={item.id}
              title={item.title}
              status={item.status}
            />
          </div>
        </header>
        {item.extractStatus === "ok" && item.contentHtml ? (
          // Sanitized at save time by sanitizeArticleHtml (src/lib/article.ts).
          <article
            className="reader-content"
            dangerouslySetInnerHTML={{ __html: item.contentHtml }}
          />
        ) : (
          <div className="rounded-lg border p-4">
            <p className="font-medium">The article text wasn&apos;t saved.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {item.extractError ?? "Extraction failed."} Try Refresh text, or
              open the original.
            </p>
            {item.excerpt && <p className="mt-3 text-sm">{item.excerpt}</p>}
          </div>
        )}
      </ReaderShell>
    </div>
  );
}
