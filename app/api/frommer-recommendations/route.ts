import { NextResponse } from "next/server";
import { sql } from "../../lib/db";

export interface DbRecommendation {
  id: number;
  name: string;
  address: string;
  reason: string;
  kakao_url: string | null;
  categories: string[] | null;
  created_at: string;
  likes: number;
}

// GET: 전체 리스트
export async function GET() {
  try {
    const rows =
      await sql`
        SELECT id, name, address, reason, kakao_url, categories, created_at, likes
        FROM recommendations
        ORDER BY created_at DESC
      `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/frommer-recommendations error:", error);
    return NextResponse.json(
      { message: "추천 리스트를 불러오지 못했어요." },
      { status: 500 }
    );
  }
}

// POST: 새 추천 추가
export async function POST(req: Request) {
  try {
    const { name, address, reason, kakaoUrl, categories } = await req.json();

    if (!name?.trim() || !address?.trim() || !reason?.trim()) {
      return NextResponse.json(
        { message: "식당 이름, 주소, 추천 이유를 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const rows =
      await sql`
        INSERT INTO recommendations (name, address, reason, kakao_url, categories)
        VALUES (
          ${name.trim()},
          ${address.trim()},
          ${reason.trim()},
          ${kakaoUrl || null},
          ${categories || []}
        )
        RETURNING id, name, address, reason, kakao_url, categories, created_at, likes
      `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/frommer-recommendations error:", error);
    return NextResponse.json(
      { message: "추천을 저장하지 못했어요." },
      { status: 500 }
    );
  }
}
