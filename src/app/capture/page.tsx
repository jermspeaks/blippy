import { CaptureForm } from "@/components/capture-form";
import { ReprocessButton } from "@/components/reprocess-button";
import { countLinkBlips } from "@/actions/capture";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const linkBlipCount = await countLinkBlips();

  return (
    <div className="container mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Capture</h1>
      <p className="mb-6 text-muted-foreground">
        Paste your daily notes as markdown. Each link becomes a blip.
      </p>
      <CaptureForm />
      {linkBlipCount > 0 && (
        <div className="mt-8 border-t pt-6">
          <p className="mb-3 text-sm text-muted-foreground">
            Changed your AI settings or prompt? Re-run them over blips you already
            imported (up to 200).
          </p>
          <ReprocessButton count={linkBlipCount} />
        </div>
      )}
    </div>
  );
}
