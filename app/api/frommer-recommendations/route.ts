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
      (await sql`
        SELECT id, name, address, reason, kakao_url, categories, created_at, likes
        FROM recommendations
        ORDER BY created_at DESC
      `) as DbRecommendation[];

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

    const trimmedName = name?.trim();
    const trimmedAddress = address?.trim();
    const trimmedReason = reason?.trim();

    if (!trimmedName || !trimmedAddress || !trimmedReason) {
      return NextResponse.json(
        { message: "식당 이름, 주소, 추천 이유를 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    // 🔴 같은 이름(대소문자 무시)의 식당 중복 체크
    const dupRows =
      (await sql`
        SELECT id
        FROM recommendations
        WHERE lower(name) = lower(${trimmedName})
        LIMIT 1
      `) as { id: number }[];

    if (dupRows.length > 0) {
      return NextResponse.json(
        { message: "이미 같은 이름의 식당이 등록되어 있어요." },
        { status: 409 } // Conflict
      );
    }

    // 🔵 신규 등록
    const rows =
      (await sql`
        INSERT INTO recommendations (name, address, reason, kakao_url, categories)
        VALUES (
          ${trimmedName},
          ${trimmedAddress},
          ${trimmedReason},
          ${kakaoUrl || null},
          ${categories || []}
        )
        RETURNING id, name, address, reason, kakao_url, categories, created_at, likes
      `) as DbRecommendation[];

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/frommer-recommendations error:", error);
    return NextResponse.json(
      { message: "추천을 저장하지 못했어요." },
      { status: 500 }
    );
  }
}
