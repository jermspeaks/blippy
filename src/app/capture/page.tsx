import { BlipForm } from "@/components/blip-form";
import { listCategories } from "@/actions/blips";

export default async function CapturePage() {
  const categories = await listCategories();

  return (
    <div className="container max-w-xl py-8">
      <h1 className="mb-6 text-2xl font-semibold">Quick capture</h1>
      <BlipForm categories={categories} />
    </div>
  );
}
