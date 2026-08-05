import { NextResponse } from "next/server";
import { savePhoto } from "@/lib/healthy-life/uploads";
import { requireUser } from "@/lib/healthy-life/prisma";
import { jsonError } from "@/lib/healthy-life/api-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Загрузите фото" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 12 МБ)" }, { status: 400 });
    }
    const saved = await savePhoto(file, "medications");
    return NextResponse.json({ photoPath: saved.photoPath });
  } catch (error) {
    return jsonError(error);
  }
}
