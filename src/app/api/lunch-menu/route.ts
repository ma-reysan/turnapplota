import { getLatestLunchMenu, syncLunchMenu } from "@/lib/lunch-menu";

export async function GET() {
  return Response.json(await getLatestLunchMenu());
}

export async function POST() {
  try {
    return Response.json(await syncLunchMenu());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No fue posible actualizar el menú" }, { status: 502 });
  }
}
