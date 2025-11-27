// app/components/KakaoMap.tsx
"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

// 기본 / 선택 마커 SVG
const DEFAULT_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30">
  <circle cx="15" cy="15" r="7" fill="#1f2937" />
</svg>
`;

const SELECTED_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34">
  <circle cx="17" cy="17" r="9" fill="#E60012" stroke="#ffffff" stroke-width="3" />
</svg>
`;

// Kakao MarkerImage 생성 헬퍼
function createMarkerImage(kakao: any, selected: boolean) {
  const svg = selected ? SELECTED_MARKER_SVG : DEFAULT_MARKER_SVG;
  const src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const size = new kakao.maps.Size(selected ? 34 : 30, selected ? 34 : 30);
  const offset = new kakao.maps.Point(
    selected ? 17 : 15,
    selected ? 17 : 15
  );
  return new kakao.maps.MarkerImage(src, size, { offset });
}

export type Place = {
  id: string;
  name: string;
  address: string;
  category: string;
  link?: string;
  mapUrl: string;
  distanceKm: number | null;
  lat: number;
  lng: number;
};

type KakaoMapProps = {
  center: { lat: number; lng: number } | null;
  places: Place[];
  selectedId: string | null;
  onMarkerClick?: (id: string) => void;
};

export default function KakaoMap({
  center,
  places,
  selectedId,
  onMarkerClick,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 1) 카카오 지도 스크립트 로딩
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.kakao && window.kakao.maps) {
      setKakaoLoaded(true);
      return;
    }

    const appKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    if (!appKey) {
      setLoadError(
        "NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY 가 설정되어 있지 않아요."
      );
      return;
    }

    const script = document.createElement("script");
    // services 라이브러리 포함
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;

    script.onload = () => {
      if (!window.kakao || !window.kakao.maps) {
        setLoadError("카카오 지도 SDK 로드에 실패했어요.");
        return;
      }
      window.kakao.maps.load(() => {
        setKakaoLoaded(true);
      });
    };

    script.onerror = () => {
      setLoadError("카카오 지도 스크립트를 불러오지 못했어요.");
    };

    document.head.appendChild(script);

    return () => {
      // 다른 페이지에서 쓰일 수 있으니 스크립트는 제거하지 않음
    };
  }, []);

  // 2) 지도/마커 생성 및 중심 이동
  useEffect(() => {
    if (!kakaoLoaded) return;
    if (!center) return;
    if (!containerRef.current) return;

    const kakao = window.kakao;

    // 지도 생성 또는 중심 이동
    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 4,
      });
    } else {
      // 🔽 기존 setCenter → panTo 로 변경해서 부드럽게 이동
      const target = new kakao.maps.LatLng(center.lat, center.lng);
      mapRef.current.panTo(target);
    }

    // 기존 마커 제거
    Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
    markersRef.current = {};

    const defaultImage = createMarkerImage(kakao, false);

    // 새 마커 생성
    places.forEach((p) => {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const marker = new kakao.maps.Marker({
        position: pos,
        map: mapRef.current,
        image: defaultImage,
      });

      markersRef.current[p.id] = marker;

      if (onMarkerClick) {
        kakao.maps.event.addListener(marker, "click", () => {
          onMarkerClick(p.id);
        });
      }
    });
  }, [kakaoLoaded, center, places, onMarkerClick]);

  // 3) 선택된 식당 강조 + 선택된 위치로 부드럽게 이동
  useEffect(() => {
    if (!kakaoLoaded || !selectedId) return;
    const kakao = window.kakao;
    const marker = markersRef.current[selectedId];
    if (!marker || !mapRef.current) return;

    const position = marker.getPosition();

    // 이미 panTo 사용 중 → 선택 변경 시에도 항상 부드럽게 이동
    mapRef.current.panTo(position);

    const defaultImage = createMarkerImage(kakao, false);
    const selectedImage = createMarkerImage(kakao, true);

    Object.values(markersRef.current).forEach((m: any) =>
      m.setImage(defaultImage)
    );
    marker.setImage(selectedImage);
  }, [selectedId, kakaoLoaded]);

  // 상태 표시
  if (loadError) {
    return (
      <div
        style={{
          width: "100%",
          borderRadius: 16,
          background: "#f3f4f6",
          color: "#b91c1c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          aspectRatio: "16 / 9",
        }}
      >
        {loadError}
      </div>
    );
  }

  if (!kakaoLoaded) {
    return (
      <div
        style={{
          width: "100%",
          borderRadius: 16,
          background: "#f3f4f6",
          color: "#6b7280",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          aspectRatio: "16 / 9",
        }}
      >
        지도를 불러오는 중이에요…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: "16 / 9",
      }}
    />
  );
}
