import { NextResponse } from "next/server";
import OpenAI from "openai";

type Menu = {
  name: string;
  reason: string;
};

export async function POST(req: Request) {
  try {
    // 1) 환경변수 체크
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY가 설정되어 있지 않아요." },
        { status: 500 }
      );
    }

    // 2) 요청 바디에서 값 꺼내기
    const { mood, keyword } = await req.json();

    // 3) OpenAI 클라이언트 만들기 (try 안에서 만들어서 에러 잡기)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
너는 한국 직장인의 점심 메뉴를 추천해주는 어시스턴트야.

사용자의 기분 또는 상황: ${mood || "(입력 없음)"}
사용자가 원하는 키워드: ${keyword || "(입력 없음)"}

아래 형식의 JSON만 반환해:
{
  "menus": [
    { "name": "메뉴명", "reason": "추천 이유" },
    { "name": "메뉴명", "reason": "추천 이유" },
    { "name": "메뉴명", "reason": "추천 이유" }
  ]
}

규칙:
- 총 3개만 추천할 것
- 내용은 한국 회사 점심 문화에 잘 맞게 작성할 것
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let json: { menus: Menu[] };

    // 4) GPT가 준 문자열을 JSON으로 변환
    try {
      json = JSON.parse(content);
    } catch (e) {
      // 혹시 JSON 파싱 실패하면 빈 배열로 안전하게 반환
      json = { menus: [] };
    }

    // 5) 항상 JSON으로 응답
    return NextResponse.json(json);
  } catch (error) {
    console.error("recommend API error:", error);
    return NextResponse.json(
      { error: "메뉴 추천 중 서버에서 오류가 발생했어요." },
      { status: 500 }
    );
  }
}
