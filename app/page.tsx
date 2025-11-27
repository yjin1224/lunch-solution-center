"use client";

import { useState, useRef } from "react";
import KakaoMap, { Place } from "./components/KakaoMap";
import FrommerRecommendSection from "./components/FrommerRecommendSection";

type SearchResponse = {
  center: { lat: number; lng: number };
  places: Place[];
};

// 로딩 메시지 후보 (마지막 …/…는 제거하고 점 애니메이션으로 대체)
const LOADING_MESSAGES = [
  "프러머 취향 읽는 중...",
  "오늘 점심 분위기 분석 중…",
  "프럼 근처 맛집 지도 펼치는 중…",
  "프러머 기분에 맞는 한 끼 찾는 중...",
  "맛집 후보 정렬하는 중…",
  "지금 프럼런치봇 회의 중...",
  "프러머가 좋아할 만한 메뉴 스캔 중…",
  "딱 맞는 점심을 위해 데이터 섞는 중…",
  "맛있는 곳부터 골라오는 중...",
  "숨겨진 프럼 맛집 아카이브 여는 중…",
];

// 거리/도보 표시 포맷
export function formatDistance(distanceKm: number | null): string {
  if (distanceKm == null) return "-";
  const meters = distanceKm * 1000;
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `약 ${distanceKm.toFixed(1)}km`;
}

export function estimateWalkingMinutes(distanceKm: number | null): string {
  if (distanceKm == null) return "-";
  const meters = distanceKm * 1000;
  const minutes = Math.max(1, Math.round(meters / 70));
  return `${minutes}분`;
}

export default function HomePage() {
  // 기본 위치값 "프럼"
  const [locationKeyword, setLocationKeyword] = useState("프럼");
  const [freeText, setFreeText] = useState("");

  const [places, setPlaces] = useState<Place[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // idle: 처음, loading: 로딩 화면, done: 결과 화면
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done">(
    "idle"
  );
  const [activeTab, setActiveTab] = useState<"search" | "prommer">("search");

  // 로딩 메시지: 본문 + 점 개수(1~3)
  const [loadingBaseMessage, setLoadingBaseMessage] = useState("");
  const [loadingDotCount, setLoadingDotCount] = useState(0);

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const handleSearch = async () => {
    setSelectedId(null);
    setErrorMsg(null);
    clearTimers();
    setSearchState("loading");

    // 🔹 메시지 하나 랜덤 선택 후, 끝의 "..." 또는 "…" 제거해서 base만 사용
    const raw =
      LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    const base = raw.replace(/(\.{3}|…)\s*$/u, ""); // 끝의 ... 또는 … 제거
    setLoadingBaseMessage(base);
    setLoadingDotCount(0);

    // 🔹 "." ".." "..." 2회 반복 애니메이션
    const DOT_STEP_MS = 400;
    const TOTAL_STEPS = 3 * 2; // 1,2,3 점 → 2회
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const id = window.setTimeout(() => {
        const count = (i % 3) + 1; // 1,2,3 반복
        setLoadingDotCount(count);
      }, (i + 1) * DOT_STEP_MS);
      timersRef.current.push(id);
    }
    const MIN_LOADING_DURATION = (TOTAL_STEPS + 1) * DOT_STEP_MS;

    // 🔹 "프럼"이면 실제 주소로 치환
    const normalizedLocation =
      locationKeyword.trim() === "프럼"
        ? "서울시 강남구 도산대로63길 18"
        : locationKeyword;

    const start = Date.now();

    try {
      const res = await fetch("/api/search-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText, locationKeyword: normalizedLocation }),
      });

      const data: SearchResponse = await res.json();

      if (!res.ok) {
        setErrorMsg((data as any)?.error ?? "검색 중 오류가 발생했어요.");
        setPlaces([]);
        setCenter(null);
      } else {
        setPlaces(data.places);
        setCenter(data.center);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("서버와 통신 중 문제가 발생했어요.");
      setPlaces([]);
      setCenter(null);
    } finally {
      const elapsed = Date.now() - start;
      const remaining = MIN_LOADING_DURATION - elapsed;

      const finish = () => {
        clearTimers();
        setSearchState("done");
      };

      if (remaining > 0) {
        const id = window.setTimeout(finish, remaining);
        timersRef.current.push(id);
      } else {
        finish();
      }
    }
  };

  const hasResult = places.length > 0;

  const handleResetSearch = () => {
    clearTimers();
    setSearchState("idle");
    setSelectedId(null);
    setErrorMsg(null);
    setPlaces([]);
    setCenter(null);
    setLocationKeyword("프럼");
    setFreeText("");
  };

  const loadingMessageWithDots =
    loadingBaseMessage +
    (loadingDotCount > 0 ? ".".repeat(loadingDotCount) : "");

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col gap-8 px-6 py-10 bg-white relative"
      style={{
        fontFamily:
          "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* 헤더 (로고 + 카피 + 탭) 중앙 정렬 */}
      <header className="space-y-6 flex flex-col items-center text-center">
        <img
          src="/lunch_title.png"
          alt="Lunch Solution Center"
          className="h-50 w-auto"
        />

        <p className="text-sm leading-relaxed text-neutral-500">
          프러머들의 점심 고민, 제가 해결해드릴게요.
        </p>

        <div className="inline-flex rounded-full bg-neutral-100 p-2 text-xs text-neutral-600">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              activeTab === "search"
                ? "bg-white text-neutral-900 border border-neutral-300"
                : "hover:text-neutral-900"
            }`}
          >
            검색
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prommer")}
            className={`ml-1 px-4 py-1.5 rounded-full transition-all ${
              activeTab === "prommer"
                ? "bg-white text-neutral-900 border border-neutral-300"
                : "hover:text-neutral-900"
            }`}
          >
            프러머 추천
          </button>
        </div>
      </header>

      {/* ───────── 검색 탭 ───────── */}
      {activeTab === "search" && (
        <>
          {/* 처음: 검색 폼 */}
          {searchState === "idle" && (
            <section className="mt-4 space-y-4">
              <div className="rounded-2xl bg-white p-4">
                <div className="space-y-4">
                  {/* 위치 입력 */}
                  <div className="space-y-0">
                    <label className="block mb-2 text-xs font-medium text-neutral-800">
                      어디 근처에서 먹고 싶나요?
                    </label>
                    <input
                      value={locationKeyword}
                      onChange={(e) => setLocationKeyword(e.target.value)}
                      placeholder="프럼 / 압구정로데오역 / 강남구청역"
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-0"
                    />
                  </div>

                  {/* 오늘 점심에 대한 말 */}
                  <div className="space-y-0">
                    <label className="block mb-2 text-xs font-medium text-neutral-800">
                      뭐가 먹고 싶은가요?
                    </label>
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="담백한 거 먹고 싶어! / 매운 국물 땡겨 / 팀 점심 가기 좋은 식당"
                      rows={3}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-0 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="mt-4 w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#cc0010] active:bg-[#b00010]"
                >
                  점심 추천 받기
                </button>
              </div>
            </section>
          )}

          {/* 결과 상태 */}
          {searchState === "done" && (
            <section className="mt-4 flex flex-1 flex-col gap-4 pb-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  검색 결과
                  {hasResult && (
                    <span className="ml-1 text-neutral-700">
                      {places.length}곳
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-600"
                >
                  다시 검색하기
                </button>
              </div>

              {errorMsg && (
                <p className="mb-2 text-xs text-red-500">{errorMsg}</p>
              )}

              {hasResult ? (
                <div className="space-y-4">
                  {/* 지도: 16:9 비율 컨테이너 */}
                  <div className="rounded-2xl bg-white p-0 overflow-hidden">
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      <KakaoMap
                        center={center}
                        places={places}
                        selectedId={selectedId}
                        onMarkerClick={(id) => setSelectedId(id)}
                      />
                    </div>
                  </div>

                  {/* 리스트 */}
                  <div
                    className="space-y-3 overflow-y-auto pr-1"
                    style={{ maxHeight: "calc(100vh - 380px)" }}
                  >
                    {places.map((p) => {
                      const distanceLabel = formatDistance(p.distanceKm);
                      const walkingLabel = estimateWalkingMinutes(
                        p.distanceKm
                      );
                      const isSelected = selectedId === p.id;

                      const displayCategory = p.category
                        ? p.category
                            .split(">")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .pop() ?? ""
                        : "";

                      return (
                        <RestaurantCard
                          key={p.id}
                          place={p}
                          isSelected={isSelected}
                          distanceLabel={distanceLabel}
                          walkingLabel={walkingLabel}
                          categoryLabel={displayCategory}
                          onSelect={() => setSelectedId(p.id)}
                          showReason={false}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                !errorMsg && (
                  <p className="mt-4 text-sm leading-relaxed text-neutral-500">
                    조건에 맞는 식당을 찾지 못했어요.{" "}
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="font-medium text-neutral-800 underline underline-offset-2"
                    >
                      다시 검색해볼까?
                    </button>
                  </p>
                )
              )}
            </section>
          )}
        </>
      )}

      {/* ───────── 프러머 추천 탭 ───────── */}
      {activeTab === "prommer" && <FrommerRecommendSection />}

      {/* 🔹 로딩 화면: 전체 화이트 배경 + 기존 로고 + 점 점점 늘어나는 메시지 */}
      {searchState === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-6">
            <img
              src="/lunch_title.png"
              alt="Lunch Solution Center"
              className="h-40 w-auto"
            />
            <p className="text-sm text-neutral-700">{loadingMessageWithDots}</p>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * ✅ 검색 결과 카드용 컴포넌트
 */
type RestaurantCardProps = {
  place: Place;
  isSelected?: boolean;
  distanceLabel: string;
  walkingLabel: string;
  categoryLabel?: string;
  onSelect?: () => void;
  showReason?: boolean;
  reasonText?: string | null;
};

export function RestaurantCard({
  place,
  isSelected = false,
  distanceLabel,
  walkingLabel,
  categoryLabel,
  onSelect,
  showReason = false,
  reasonText,
}: RestaurantCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
        isSelected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1 text-[15px] font-semibold tracking-[-0.01em]">
            <span>{place.name}</span>
            {categoryLabel && (
              <span
                className={`text-[11px] font-normal ${
                  isSelected ? "text-neutral-200" : "text-neutral-500"
                }`}
              >
                · {categoryLabel}
              </span>
            )}
          </div>

          <div
            className={`text-xs ${
              isSelected ? "text-neutral-100/90" : "text-neutral-500"
            }`}
          >
            {place.address}
          </div>

          <div className="mt-1 flex items-center gap-4 text-xs">
            <div>
              📍{" "}
              <span
                className={
                  isSelected ? "text-neutral-50" : "text-neutral-700"
                }
              >
                {distanceLabel}
              </span>
            </div>
            <div>
              🕐{" "}
              <span
                className={
                  isSelected ? "text-neutral-50" : "text-neutral-700"
                }
              >
                {walkingLabel}
              </span>
            </div>
          </div>

          {/* (현재는 검색 탭에서 showReason=false 로만 사용 중) */}
          {showReason && reasonText && (
            <div className="mt-2 text-xs">
              <span
                className={
                  isSelected ? "text-neutral-50" : "text-neutral-700"
                }
              >
                <span className="font-medium">프러머 추천 이유</span>{" "}
                <span>“{reasonText}”</span>
              </span>
            </div>
          )}
        </div>

        <a
          href={place.mapUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <img
            src="/kakaomap_basic.png"
            alt="카카오맵에서 보기"
            className="h-8 w-8 rounded-lg"
          />
        </a>
      </div>
    </button>
  );
}
