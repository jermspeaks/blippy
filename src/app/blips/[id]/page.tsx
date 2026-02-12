import { getBlipById } from "@/actions/blips";
import { notFound } from "next/navigation";
import { BlipDetail } from "@/components/blip-detail";
import { listCategories } from "@/actions/blips";

export default async function BlipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blip = await getBlipById(id);
  if (!blip) notFound();
  const categories = await listCategories();

  return (
    <div className="container max-w-xl py-8">
      <BlipDetail blip={blip} categories={categories} />
    </div>
  );
}
