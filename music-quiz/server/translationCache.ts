import fs from "fs";
import path from "path";

const CACHE_FILE = path.resolve(__dirname, "../translation-cache.json");

// 구조: { "Earth Wind & Fire": ["어스 윈드 앤 파이어", "earthwindfire"] }
let cache: Record<string, string[]> = {};

// 서버 시작 시 JSON 파일에서 캐시 불러오기
export function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      cache = JSON.parse(data);
      console.log(`번역 캐시 로드: ${Object.keys(cache).length}개`);
    }
  } catch {
    cache = {};
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

// 정답 후보 목록 조회
export function getCachedVariants(original: string): string[] | null {
  return cache[original] || null;
}

// 정답 후보 목록 저장
export function setCachedVariants(original: string, variants: string[]) {
  cache[original] = variants;
  saveCache();
}

// 텍스트 정규화 (공백, 특수문자 제거 + 소문자)
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[!?.,'"()\-]/g, "");
}

// DeepL로 영어 → 한글 번역
async function translateToKorean(text: string): Promise<string> {
  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      target_lang: "KO",
      source_lang: "EN",
    }),
  });

  const data = await res.json();
  return data.translations[0].text;
}

// 영어 텍스트의 정답 후보 목록 생성 (영어 + 한글)
export async function getKoreanVariants(text: string): Promise<string[]> {
  // 캐시에 있으면 바로 반환
  const cached = getCachedVariants(text);
  if (cached) return cached;

  try {
    const korean = await translateToKorean(text);
    console.log(`DeepL 번역: ${text} → ${korean}`);

    const variants = [
      normalize(text), // 영어 원문
      normalize(korean), // 한글 번역
    ];

    setCachedVariants(text, variants);
    return variants;
  } catch (e) {
    console.error(`번역 실패: ${text}`, e);
    // 번역 실패해도 영어 원문으로 정답 체크는 가능하게
    return [normalize(text)];
  }
}
