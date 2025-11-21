// app/api/search-places/route.ts
import { NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  console.error("KAKAO_REST_API_KEY 가 설정되어 있지 않습니다.");
}

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

// 키워드(자유 텍스트) + 좌표 기반 식당 검색 (여러 페이지 합치기)
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

    // 2️⃣ 실제 식당 검색: 자유 텍스트 + 맛집 키워드
    const searchKeyword = `${freeText} 맛집`;
    const kakaoPlaces = await searchRestaurantsAround(center, searchKeyword);

    const baseLon = center.x;
    const baseLat = center.y;

    // 3️⃣ 프론트에 넘길 형태로 변환
    const places = kakaoPlaces.map((p) => {
      let distanceKm: number | null = null;

      // Kakao가 distance(m)를 이미 주면 그걸 우선 사용
      if (p.distance && p.distance !== "0") {
        const meters = Number(p.distance);
        if (!Number.isNaN(meters)) {
          distanceKm = Math.round((meters / 1000) * 10) / 10;
        }
      } else {
        // distance 없으면 직접 계산
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
        name: p.place_name,
        category: p.category_name,
        address: p.road_address_name || p.address_name,
        link: p.place_url,
        mapUrl: p.place_url, // 바로 카카오맵으로 이동
        distanceKm,
      };
    });

    return NextResponse.json({ places });
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
