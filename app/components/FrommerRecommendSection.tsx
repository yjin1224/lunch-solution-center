"use client";

import { useEffect, useState, FormEvent } from "react";
import KakaoMap, { Place } from "./KakaoMap";

declare const kakao: any;

type DbRecommendation = {
  id: number;
  name: string;
  address: string;
  reason: string;
  kakao_url: string | null;
  categories: string[] | null;
  created_at: string;
  likes: number;
  likedByMe?: boolean;
};

// 태그: 팀회식 / 커피챗 제거
const CATEGORY_OPTIONS = ["음식점", "카페", "프럼다이닝"];

export default function FrommerRecommendSection() {
  const [recommendations, setRecommendations] = useState<DbRecommendation[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [kakaoUrl, setKakaoUrl] = useState("");
  const [reason, setReason] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 지도 관련
  const [mapPlaces, setMapPlaces] = useState<Place[]>([]);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 태그 필터(지도 + 리스트 공통)
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // 정렬 기준 (리스트용)
  const [sortBy, setSortBy] = useState<"latest" | "likes">("latest");

  const DEFAULT_CENTER = { lat: 37.525, lng: 127.03 };

  // kakao ready check
  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () =>
      !!(window.kakao && window.kakao.maps && window.kakao.maps.services);

    if (check()) {
      setKakaoReady(true);
      return;
    }

    const timer = setInterval(() => {
      if (check()) {
        setKakaoReady(true);
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, []);

  // 리스트 불러오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingList(true);
        const res = await fetch("/api/frommer-recommendations");
        const data: DbRecommendation[] = await res.json();
        if (!res.ok) throw new Error("리스트를 불러오지 못했어요.");

        // 초기 likedByMe false로
        const withLikeState = data.map((d) => ({
          ...d,
          likedByMe: false,
        }));
        setRecommendations(withLikeState);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "프러머 추천을 불러오지 못했어요.");
      } finally {
        setLoadingList(false);
      }
    };

    fetchData();
  }, []);

  // 주소 → 좌표 변환
  useEffect(() => {
    if (!kakaoReady) return;

    if (recommendations.length === 0) {
      setMapPlaces([]);
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();

    const convert = async () => {
      const promises = recommendations.map(
        (r) =>
          new Promise<Place | null>((resolve) => {
            geocoder.addressSearch(
              r.address,
              (result: any[], status: string) => {
                if (
                  status === kakao.maps.services.Status.OK &&
                  result?.[0]
                ) {
                  const { x, y } = result[0];
                  resolve({
                    id: String(r.id),
                    name: r.name,
                    address: r.address,
                    lat: Number(y),
                    lng: Number(x),
                    category: "프러머 추천",
                    distanceKm: null,
                    mapUrl:
                      r.kakao_url ||
                      `https://map.kakao.com/link/map/${encodeURIComponent(
                        r.name
                      )},${y},${x}`,
                  });
                } else {
                  resolve(null);
                }
              }
            );
          })
      );

      const places = await Promise.all(promises);
      setMapPlaces(places.filter(Boolean) as Place[]);
    };

    convert();
  }, [recommendations, kakaoReady]);

  // 태그 토글 (작성 폼)
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // 추천 등록
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !address.trim() || !reason.trim()) {
      setErrorMsg("식당 이름, 주소, 추천 이유를 모두 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/frommer-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          reason,
          kakaoUrl: kakaoUrl || null,
          categories: selectedCategories,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "추천을 저장하지 못했어요.");
        return;
      }

      setRecommendations((prev) => [
        { ...data, likedByMe: false },
        ...prev,
      ]);

      setName("");
      setAddress("");
      setKakaoUrl("");
      setReason("");
      setSelectedCategories([]);
      setIsFormOpen(false);
    } catch (e: any) {
      setErrorMsg("추천을 저장하지 못했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  // 좋아요 토글
  const handleLike = async (item: DbRecommendation) => {
    const { id, likedByMe } = item;

    try {
      const res = await fetch("/api/frommer-recommendations/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, toggle: true }),
      });

      const data = await res.json();
      if (!res.ok) return;

      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                likes: data.likes,
                likedByMe: !likedByMe,
              }
            : r
        )
      );
    } catch (e) {
      console.error("like error:", e);
    }
  };

  // 필터
  const hasFilter = !!activeFilter;

  const filteredRecommendations = hasFilter
    ? recommendations.filter((r) =>
        (r.categories || []).includes(activeFilter as string)
      )
    : recommendations;

  const filteredMapPlaces = hasFilter
    ? mapPlaces.filter((p) => {
        const rec = recommendations.find((r) => String(r.id) === p.id);
        if (!rec) return false;
        return (rec.categories || []).includes(activeFilter as string);
      })
    : mapPlaces;

  // 정렬
  const sortedRecommendations = [...filteredRecommendations].sort(
    (a, b) => {
      if (sortBy === "likes") {
        return (b.likes ?? 0) - (a.likes ?? 0);
      }
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    }
  );

  const mapCenter =
    filteredMapPlaces.length > 0
      ? {
          lat: filteredMapPlaces[0].lat,
          lng: filteredMapPlaces[0].lng,
        }
      : DEFAULT_CENTER;

  return (
    <section className="mt-4 flex flex-col gap-3 pb-10">
      {/* 안내 카드 */}
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-700 relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            프러머가 함께 채우는 리스트예요.
            <br />
            맛있는 곳이 생각나면 언제든 추가해주세요!
          </p>

          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            className="rounded-full border border-neutral-900 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white transition
              absolute right-4 bottom-3 sm:static"
          >
            식당 추천하기
          </button>
        </div>
      </div>

      {/* 작성 폼 */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-4 text-sm"
        >
          <div className="space-y-0">
            <label className="block mb-2 text-xs font-medium text-neutral-800">
              식당 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="뉴만두집"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
            />
          </div>

          <div className="space-y-0">
            <label className="block mb-2 text-xs font-medium text-neutral-800">
              주소
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="서울 강남구 압구정로 338 1층"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
            />
          </div>

          <div className="space-y-0">
            <label className="block mb-2 text-xs font-medium text-neutral-800">
              카카오맵 링크
            </label>
            <input
              value={kakaoUrl}
              onChange={(e) => setKakaoUrl(e.target.value)}
              placeholder="https://place.map.kakao.com/13092552"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
            />
          </div>

          <div className="space-y-0 mb-[-4px]">
            <label className="block mb-2 text-xs font-medium text-neutral-800">
              추천 이유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="담백한 만두국 먹고싶다면 여기!"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 resize-none"
            />
          </div>

          <div className="space-y-0">
            <label className="block mb-2 text-xs font-medium text-neutral-800">
              태그
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-[11px] border transition ${
                      active
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-700 border-neutral-300"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-neutral-900 text-white px-4 py-1.5 text-[11px] disabled:opacity-70"
            >
              {submitting ? "추가 중…" : "리스트에 추가"}
            </button>
          </div>
        </form>
      )}

      {/* 태그 필터 + 정렬 */}
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        {/* 태그 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] border transition ${
              !activeFilter
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-700 border-neutral-300"
            }`}
          >
            전체
          </button>
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setActiveFilter((prev) => (prev === cat ? null : cat))
              }
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] border transition ${
                activeFilter === cat
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 정렬 드롭다운 */}
        <div className="flex justify-start sm:justify-end">
          <div className="relative inline-flex">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "latest" | "likes")
              }
              className="appearance-none text-[11px] border border-neutral-300 rounded-lg px-3 pr-7 py-1.5 bg-neutral-50 text-neutral-700"
            >
              <option value="latest">최신순</option>
              <option value="likes">좋아요순</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <img src="/keyboard_arrow_down.svg" alt="" className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* 지도 */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <KakaoMap
            center={mapCenter}
            places={filteredMapPlaces}
            selectedId={selectedId}
            onMarkerClick={(id) => setSelectedId(id)}
          />
        </div>
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {sortedRecommendations.length === 0 && !loadingList ? (
          <p className="text-[11px] text-neutral-500">
            {hasFilter
              ? "해당 태그에 해당하는 식당이 없어요. 다른 태그를 선택해볼까요?"
              : "아직 프러머들이 추가한 식당이 없어요. 첫 번째로 추천을 남겨볼까요?"}
          </p>
        ) : (
          sortedRecommendations.map((r) => {
            const idStr = String(r.id);
            const place = filteredMapPlaces.find(
              (p) => p.id === idStr
            );
            const mapUrl = r.kakao_url || place?.mapUrl;

            return (
              <PrommerCard
                key={r.id}
                id={r.id}
                name={r.name}
                address={r.address}
                kakaoUrl={mapUrl}
                reason={r.reason}
                categories={r.categories || []}
                likes={r.likes ?? 0}
                isSelected={selectedId === idStr}
                onClick={() => setSelectedId(idStr)}
                onLike={() => handleLike(r)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------
   PrommerCard
-------------------------------------------------------------------- */

type PrommerCardProps = {
  id: number;
  name: string;
  address: string;
  kakaoUrl?: string;
  reason?: string;
  categories: string[];
  likes: number;
  likedByMe?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onLike?: () => void;
};

function PrommerCard({
  name,
  address,
  kakaoUrl,
  reason,
  categories,
  likes,
  likedByMe,
  isSelected,
  onClick,
  onLike,
}: PrommerCardProps) {
  return (
    <div
      role="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-sm text-left transition cursor-pointer ${
        isSelected
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {/* 상단: 식당 정보 */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-full space-y-1">
          <div className="text-[15px] font-semibold">{name}</div>
          <div
            className={`text-xs ${
              isSelected ? "text-neutral-200" : "text-neutral-600"
            }`}
          >
            {address}
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {categories.map((c) => (
                <span
                  key={c}
                  className={`px-2 py-0.5 rounded-full text-[10px] border ${
                    isSelected
                      ? "border-neutral-400 text-neutral-200"
                      : "border-neutral-300 text-neutral-700"
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 카카오맵 아이콘 */}
        {kakaoUrl && (
          <a
            href={kakaoUrl}
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
        )}
      </div>

      {/* 하단: 추천 이유 + 좋아요 버튼 */}
      {(reason || likes >= 0) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {reason ? (
            <div className="text-xs flex items-start gap-0.5">
              <img
                src="/format_quote_open.svg"
                alt=""
                className="w-4 h-4 mt-[-1px] opacity-70"
              />
              <span
                className={
                  isSelected ? "text-neutral-100" : "text-neutral-700"
                }
              >
                {reason}
              </span>
              <img
                src="/format_quote_close.svg"
                alt=""
                className="w-4 h-4 mt-[-1px] opacity-70"
              />
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike?.();
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
              likedByMe
                ? isSelected
                  ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                  : "bg-neutral-800 text-white border-neutral-800"
                : isSelected
                ? "border-neutral-400 bg-neutral-800 text-neutral-50"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <span>👍</span>
            <span>{likes}</span>
          </button>
        </div>
      )}
    </div>
  );
}
