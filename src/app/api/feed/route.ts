import { getFeedBlips } from "@/actions/blips";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;
  const blips = await getFeedBlips(categoryId);
  return Response.json(blips);
}
