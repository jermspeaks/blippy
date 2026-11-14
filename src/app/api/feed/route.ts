import { getFeedBlips } from "@/actions/blips";

export async function GET() {
  const blips = await getFeedBlips();
  return Response.json(blips);
}
