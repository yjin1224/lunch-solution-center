// app/api/search-places/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!KAKAO_REST_API_KEY) {
  console.error("KAKAO_REST_API_KEY 가 설정되어 있지 않습니다.");
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Kakao Local API 응답 타입 (필요한 부분만 정의)
type KakaoPlace = {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  place_url: string;
  distance?: string; // 중심 좌표로부터 거리 (m), x/y/radius 사용 시 제공
};

// 위도/경도로 거리(km) 계산 (distance 없을 때 대비용)
function calcDistanceKmFromCoords(
  baseLon: number | null,
  baseLat: number | null,
  itemLon: number,
  itemLat: number
): number | null {
  if (baseLon === null || baseLat === null) return null;

  const R = 6371; // 지구 반지름(km)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(itemLat - baseLat);
  const dLon = toRad(itemLon - baseLon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(baseLat)) *
      Math.cos(toRad(itemLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return Math.round(dist * 10) / 10; // 소수 한 자리까지
}

// Kakao API 공통 fetch 헬퍼 (에러 메시지 그대로 노출)
async function kakaoFetch(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    console.error("Kakao API 오류:", res.status, text);
    const errorInfo =
      json && json.errorType
        ? `${json.errorType}: ${json.message}`
        : text || "no body";
    throw new Error(`Kakao API error ${res.status} - ${errorInfo}`);
  }

  return json;
}

// 주소(또는 지역명) → 좌표 변환
async function getCoordsFromAddress(
  address: string
): Promise<{ x: number; y: number } | null> {
  const encoded = encodeURIComponent(address);

  // 1) 주소 검색 먼저 시도 (도로명/지번)
  {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encoded}&size=1`;
    const data = await kakaoFetch(url);
    const doc = data?.documents?.[0];

    if (doc) {
      const x = Number(doc.x);
      const y = Number(doc.y);
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        return { x, y };
      }
    }
  }

  // 2) 주소 검색 결과가 없으면, 키워드 검색으로 재시도 (역/동/상권 이름 등)
  {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encoded}&size=1`;
    const data = await kakaoFetch(url);
    const doc = data?.documents?.[0];

    if (doc) {
      const x = Number(doc.x);
      const y = Number(doc.y);
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        return { x, y };
      }
    }
  }

  // 둘 다 실패하면 null
  return null;
}

// -----------------------------
// 🔥 감성/맛 표현 매핑 + 메뉴 키워드 정의
// -----------------------------

// 감성/맛 표현 → 메뉴 카테고리 매핑
const tasteMapping: Record<string, string[]> = {
  "담백": ["한식", "백반", "국수", "샐러드"],
  "가벼운": ["샐러드", "포케", "국수", "백반"],
  "깔끔": ["백반", "국수", "한식"],
  "얼큰": ["찌개", "탕", "칼국수", "국밥"],
  "매콤": ["찌개", "국밥", "중식"],
  "매운": ["찌개", "국밥", "중식"],
  "든든": ["고기", "한식", "중식"],
  "따뜻": ["찌개", "국물", "칼국수", "국밥"],
  "시원": ["냉면", "메밀", "국수"],
  "해장": ["해장국", "국밥", "라멘", "칼국수"],
  "기름진 거 말고": ["샐러드", "국수", "백반"],
  "가볍게": ["샐러드", "국수", "백반"],
};

// 실제 Kakao 검색에 쓸 메뉴/카테고리 키워드 리스트
const MENU_KEYWORDS = [
  // 구체적인 찌개류 먼저
  "된장찌개",
  "김치찌개",
  "순두부찌게",
  "순두부찌개",
  "부대찌개",
  "청국장",
  // 그다음 큰 카테고리들
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "카페",
  "고기",
  "고깃집",
  "파스타",
  "라멘",
  "라면",
  "초밥",
  "스시",
  "국밥",
  "찌개",
  "백반",
  "샤브샤브",
  "삼겹살",
  "햄버거",
  "피자",
  "냉면",
  "칼국수",
  "족발",
  "보쌈",
  "찜닭",
  "치킨",
  "해장국",
  "포케",
  "샐러드",
  "디저트",
  "쌀국수",
  "샌드위치",
  "베트남 음식",
  "반미",
];

// 사용자의 자유 문장에서 감성 키워드 추출
function extractTasteKeywords(text: string): string[] {
  return Object.keys(tasteMapping).filter((key) => text.includes(key));
}

// 감성 키워드를 메뉴 카테고리로 확장
function mapTasteToMenus(keywords: string[]): string[] {
  const result = new Set<string>();
  keywords.forEach((kw) => {
    tasteMapping[kw].forEach((m) => result.add(m));
  });
  return Array.from(result);
}

// 문장에서 MENU_KEYWORDS만 골라내기 (길이 긴 키워드 우선)
function extractMenuKeywords(text: string): string[] {
  const sorted = [...MENU_KEYWORDS].sort((a, b) => b.length - a.length);
  const result: string[] = [];

  for (const w of sorted) {
    if (text.includes(w)) {
      result.push(w);
    }
  }
  return result;
}

// freeText → Kakao 검색용 "키워드 배열"로 변환
async function buildSearchKeywords(freeText: string): Promise<string[]> {
  const base = freeText.trim();
  if (!base) return [];

  // 1️⃣ 감성 키워드(담백, 얼큰, 가볍게 등) 우선 처리
  const tasteKeywords = extractTasteKeywords(base);
  if (tasteKeywords.length > 0) {
    const menus = mapTasteToMenus(tasteKeywords);
    if (menus.length > 0) {
      return menus.slice(0, 4);
    }
  }

  // 2️⃣ 사용자가 문장 안에 메뉴/카테고리 단어를 직접 쓴 경우
  const menuMatches = extractMenuKeywords(base);
  if (menuMatches.length > 0) {
    return menuMatches.slice(0, 4);
  }

  // 3️⃣ OpenAI 사용 불가하면 그냥 원문 하나로 검색 시도
  if (!openai) {
    return [base];
  }

  // 4️⃣ OpenAI로 자유 문장을 → 음식 키워드 1~3개로 변환
  const prompt = `
사용자가 한 한국어 문장은 "오늘 점심에 대한 느낌/기분/상황" 이야.
이 문장을 보고, 실제 지도 서비스에서 사용할 수 있는 "음식/식당 검색 키워드"만 1~3개 뽑아줘.

- 한국어로만 작성해.
- 예: "얼큰한 국물 먹고 싶어" → "국밥, 찌개"
- 예: "담백하고 자극적이지 않은 거 먹고 싶어" → "한식, 백반"
- 예: "달달한 디저트 먹고 싶어" → "카페, 디저트"
- 예: "반미 먹고 싶다" → "반미, 베트남 음식"
- 예: "된장찌개 먹고싶다" → "된장찌개, 한식"
- 쉼표로 구분된 한 줄로만 출력하고, 다른 말은 쓰지 마.

사용자 문장: "${base}"
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return [base];

    const keywords = text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const filtered = keywords.slice(0, 4);
    return filtered.length > 0 ? filtered : [base];
  } catch (e) {
    console.error("OpenAI 키워드 생성 에러:", e);
    return [base];
  }
}

// 키워드(단일) + 좌표 기반 식당 검색 (여러 페이지 합치기)
async function searchRestaurantsAround(
  center: { x: number; y: number },
  keyword: string
): Promise<KakaoPlace[]> {
  const encodedQuery = encodeURIComponent(keyword);

  const all: KakaoPlace[] = [];
  const radius = 1000; // 1km 반경
  const size = 15; // 한 페이지 최대 15개
  const maxPages = 3; // 최대 3페이지 → 이론상 45개

  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
      `?query=${encodedQuery}` +
      `&category_group_code=FD6` + // 음식점만
      `&x=${center.x}&y=${center.y}` +
      `&radius=${radius}` +
      `&size=${size}&page=${page}`;

    const data = await kakaoFetch(url);

    const documents: KakaoPlace[] = data?.documents ?? [];
    if (documents.length === 0) break;

    all.push(...documents);

    if (data?.meta?.is_end) break; // 마지막 페이지면 중단
  }

  return all;
}

// 여러 키워드에 대해 검색하고 결과 합치기
async function searchRestaurantsWithKeywords(
  center: { x: number; y: number },
  keywords: string[]
): Promise<KakaoPlace[]> {
  const all: KakaoPlace[] = [];

  for (const kw of keywords) {
    const trimmed = kw.trim();
    if (!trimmed) continue;

    const partial = await searchRestaurantsAround(center, `${trimmed} 맛집`);
    all.push(...partial);
  }

  // id 기준으로 중복 제거
  const byId = new Map<string, KakaoPlace>();
  for (const p of all) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }

  return Array.from(byId.values());
}

export async function POST(req: Request) {
  try {
    if (!KAKAO_REST_API_KEY) {
      return NextResponse.json(
        { error: "KAKAO_REST_API_KEY 가 설정되어 있지 않아요." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { freeText, locationKeyword } = body as {
      freeText: string;
      locationKeyword: string;
    };

    if (!locationKeyword || typeof locationKeyword !== "string") {
      return NextResponse.json(
        { error: "어디 근처에서 찾을지(주소/지역)를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!freeText || typeof freeText !== "string") {
      return NextResponse.json(
        { error: "오늘 점심에 대한 생각을 한 줄 적어 주세요." },
        { status: 400 }
      );
    }

    // 1️⃣ 주소/지역 → 좌표
    const center = await getCoordsFromAddress(locationKeyword);
    if (!center) {
      return NextResponse.json(
        { error: "입력한 주소/지역으로 위치를 찾지 못했어요." },
        { status: 400 }
      );
    }

    // 2️⃣ freeText → 검색용 키워드 배열 변환
    const keywordList = await buildSearchKeywords(freeText);
    const keywordSet = new Set<string>();

    keywordList.forEach((k) => {
      const trimmed = k.trim();
      if (trimmed) keywordSet.add(trimmed);
    });

    const raw = freeText.trim();
    if (raw) {
      // 항상 원래 입력 문장도 한 번은 검색에 사용
      keywordSet.add(raw);
    }

    const effectiveKeywords = Array.from(keywordSet);
    if (effectiveKeywords.length === 0 && raw) {
      effectiveKeywords.push(raw);
    }

    // 3️⃣ 실제 식당 검색 (여러 키워드 합산)
    const kakaoPlaces = await searchRestaurantsWithKeywords(
      center,
      effectiveKeywords
    );

    const baseLon = center.x;
    const baseLat = center.y;

    // 4️⃣ 프론트에 넘길 형태로 변환 (위치 + 중심 포함)
    const places = kakaoPlaces.map((p) => {
      let distanceKm: number | null = null;

      if (p.distance && p.distance !== "0") {
        const meters = Number(p.distance);
        if (!Number.isNaN(meters)) {
          distanceKm = Math.round((meters / 1000) * 10) / 10;
        }
      } else {
        const itemLon = Number(p.x);
        const itemLat = Number(p.y);
        if (!Number.isNaN(itemLon) && !Number.isNaN(itemLat)) {
          distanceKm = calcDistanceKmFromCoords(
            baseLon,
            baseLat,
            itemLon,
            itemLat
          );
        }
      }

      return {
        id: p.id,
        name: p.place_name,
        category: p.category_name,
        address: p.road_address_name || p.address_name,
        link: p.place_url,
        mapUrl: p.place_url,
        distanceKm,
        lat: Number(p.y),
        lng: Number(p.x),
      };
    });

    return NextResponse.json({
      center: { lat: center.y, lng: center.x },
      places,
    });
  } catch (err: any) {
    console.error("search-places Kakao 핸들러 에러:", err);
    return NextResponse.json(
      {
        error:
          typeof err?.message === "string"
            ? err.message
            : "맛집(장소) 검색 중 서버에서 오류가 발생했어요.",
      },
      { status: 500 }
    );
  }
}
