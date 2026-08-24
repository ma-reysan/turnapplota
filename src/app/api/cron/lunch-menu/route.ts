import { syncLunchMenu } from "@/lib/lunch-menu";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const menu = await syncLunchMenu();
    return Response.json({ ok: true, menuDate: menu.menuDate });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No fue posible actualizar el menú" }, { status: 502 });
  }
}
