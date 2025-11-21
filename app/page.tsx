"use client";

import { useState } from "react";

type Place = {
  name: string;
  category: string;
  description: string;
  address: string;
  link: string;
  mapUrl: string;
  distanceKm: number | null;
};

export default function Home() {
  const [locationKeyword, setLocationKeyword] = useState("");
  const [freeText, setFreeText] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchPlaces = async () => {
    setError(null);
    setPlaces([]);
    setVisibleCount(10);
    setHasSearched(false);

    if (!locationKeyword.trim()) {
      setError("어디 근처에서 먹을지, 주소나 지역을 먼저 적어줘 😊");
      return;
    }

    if (!freeText.trim()) {
      setError("오늘 점심에 대한 생각을 자유롭게 한 줄 적어줘 😊");
      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch("/api/search-places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationKeyword,
          freeText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "맛집(장소) 검색에 실패했어요.");
      }

      setPlaces(data.places || []);
      setHasSearched(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "알 수 없는 오류가 발생했어요.");
    } finally {
      setIsSearching(false);
    }
  };

  const visiblePlaces = places.slice(0, visibleCount);
  const hasMore = visibleCount < places.length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-xl flex-col px-4 py-8">
        {/* 헤더 */}
        <header className="mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Lunch Assistant
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            오늘 점심 어디 갈까?
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            주소(또는 지역)와 오늘 점심에 대한 한 줄을 적으면,
            <br />
            근처 식당 리스트를 바로 보여줄게요.
          </p>
        </header>

        {/* 입력 영역 */}
        <section className="mb-4 space-y-3">
          {/* 1. 주소 / 지역 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              어디 근처에서 먹을까요? (주소 / 지역)
            </label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="예: 서울 관악구 은천로 11-18, 역삼역, 을지로입구, 서울 강남구 등"
              value={locationKeyword}
              onChange={(e) => setLocationKeyword(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              회사 주소를 정확히 적어도 되고, 지하철역 / 동 이름처럼 대략적인
              지역만 적어도 괜찮아요.
            </p>
          </div>

          {/* 2. 자유 텍스트 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              오늘 점심에 대해 하고 싶은 말
            </label>
            <textarea
              className="h-20 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="예: 진짜 아무거나 말해줘, 나 결정 못 하겠어 😭"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
            />
          </div>

          <button
            onClick={handleSearchPlaces}
            disabled={isSearching}
            className="mt-2 h-11 w-full rounded-2xl bg-slate-900 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSearching ? "근처 식당 찾는 중…" : "오늘 점심 고르기"}
          </button>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </section>

        {/* 로딩 텍스트 */}
        {isSearching && (
          <p className="mb-3 text-xs text-slate-500">
            입력한 주소 기준으로 근처 식당을 탐색하는 중이에요…
          </p>
        )}

        {/* 결과 없을 때 안내 */}
        {!isSearching && hasSearched && places.length === 0 && !error && (
          <p className="mt-4 text-xs text-slate-500">
            주변에서 조건에 맞는 식당을 찾지 못했어요. 주소나 문장을 조금 바꿔볼까요?
          </p>
        )}

        {/* 근처 장소(맛집) 리스트 */}
        {visiblePlaces.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              근처 장소
            </h2>
            <div className="space-y-3">
              {visiblePlaces.map((place) => (
                <article
                  key={place.name + place.address}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[13px] font-semibold text-slate-900">
                        {place.name}
                      </h3>
                      {place.address && (
                        <p className="mt-1 text-[11px] text-slate-600">
                          {place.address}
                        </p>
                      )}
                      {place.description && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {place.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {place.distanceKm !== null && (
                        <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[11px] text-slate-700">
                          약 {place.distanceKm}km
                        </span>
                      )}
                      {place.category && (
                        <span className="text-right text-[10px] text-slate-500">
                          {place.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <a
                      href={place.mapUrl}
                      target="_blank"
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 underline-offset-2 hover:bg-slate-100"
                    >
                      네이버 지도에서 보기
                    </a>
                    {place.link && (
                      <a
                        href={place.link}
                        target="_blank"
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 underline-offset-2 hover:bg-slate-100"
                      >
                        상세 정보 보기
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* 더 보기 버튼 */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((c) => c + 10)}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                더 보기
              </button>
            )}
          </section>
        )}

        {/* 첫 화면 안내 */}
        {!hasSearched && !isSearching && places.length === 0 && !error && (
          <p className="mt-4 text-xs text-slate-500">
            아직 검색 전이에요. 주소와 한 줄을 적고 &apos;오늘 점심 고르기&apos;를
            눌러보세요.
          </p>
        )}
      </div>
    </main>
  );
}
