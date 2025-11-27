// app/api/frommer-recommendations/like/route.ts
import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";

export async function POST(req: Request) {
  try {
    const { id, isLike } = await req.json();

    const idNum = typeof id === "number" ? id : parseInt(String(id), 10);

    if (!Number.isInteger(idNum) || typeof isLike !== "boolean") {
      return NextResponse.json(
        { message: "잘못된 요청입니다.", detail: { id, isLike } },
        { status: 400 }
      );
    }

    // 1) 현재 likes 값 확인
    const currentRows = await sql`
      SELECT likes
      FROM recommendations
      WHERE id = ${idNum}
    `;

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json(
        { message: "해당 식당을 찾지 못했어요." },
        { status: 404 }
      );
    }

    const currentLikes = currentRows[0].likes as number;

    // 2) 증가/감소 계산
    const newLikes = isLike
      ? currentLikes + 1
      : Math.max(0, currentLikes - 1);

    // 3) 업데이트 후 row 반환
    const rows = await sql`
      UPDATE recommendations
      SET likes = ${newLikes}
      WHERE id = ${idNum}
      RETURNING id, name, address, reason, kakao_url, categories, created_at, likes
    `;

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
