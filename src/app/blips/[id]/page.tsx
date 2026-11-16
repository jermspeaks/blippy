import { getBlipById } from "@/actions/blips";
import { notFound } from "next/navigation";
import { readingItemIdsByBlip } from "@/actions/reading";
import { BlipDetail } from "@/components/blip-detail";

export default async function BlipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blip = await getBlipById(id);
  if (!blip) notFound();
  const readingItemId = (await readingItemIdsByBlip([blip.id]))[blip.id] ?? null;

  return (
    <div className="container mx-auto max-w-xl px-8 py-8">
      <BlipDetail blip={blip} readingItemId={readingItemId} />
    </div>
  );
}
