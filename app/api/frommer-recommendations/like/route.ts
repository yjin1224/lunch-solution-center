// app/api/frommer-recommendations/like/route.ts
import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";

export async function POST(req: Request) {
  try {
    // 👇 id와 delta 둘 다 받기
    const { id, delta } = await req.json();

    const idNum =
      typeof id === "number" ? id : parseInt(String(id), 10);

    if (!Number.isInteger(idNum)) {
      return NextResponse.json(
        { message: "잘못된 ID입니다.", detail: { id } },
        { status: 400 }
      );
    }

    // 👇 delta가 -1이면 감소, 그 외에는 +1
    const change = delta === -1 ? -1 : 1;

    const rows =
      (await sql`
        UPDATE recommendations
        SET likes = GREATEST(0, COALESCE(likes, 0) + ${change})
        WHERE id = ${idNum}
        RETURNING
          id,
          name,
          address,
          reason,
          kakao_url,
          categories,
          created_at,
          COALESCE(likes, 0) AS likes
      `) as any[];

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { message: "해당 식당을 찾지 못했어요." },
        { status: 404 }
      );
    }

    const updated = rows[0];
    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/frommer-recommendations/like error:", error);
    return NextResponse.json(
      { message: "좋아요 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}
