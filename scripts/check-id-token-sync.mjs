#!/usr/bin/env node
/**
 * idToken 검증 로직 동기화 확인 스크립트
 *
 * shared/verify-id-token.gs를 정본으로 삼아, 로그인이 필요한 각
 * 백엔드(.gs) 파일에 들어있는 verifyIdToken 함수가 정본과 (공백을
 * 제외하고) 완전히 동일한지 검사한다.
 *
 * 사용법: node scripts/check-id-token-sync.mjs
 * 통과: 종료 코드 0
 * 불일치 발견: 어느 파일이 다른지 출력하고 종료 코드 1
 *
 * 주의: 변수명이나 코드 순서가 다르면 "기능은 같아도" 불일치로
 * 판정된다. 이는 의도된 동작이다 — 텍스트가 정본과 다르면 향후
 * 정본만 수정하고 이 파일에 반영하는 것을 잊기 쉽기 때문이다.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const CANONICAL_PATH = join(REPO_ROOT, "shared/verify-id-token.gs");

// verifyIdToken을 그대로 포함하고 있어야 하는 배포 대상 파일 목록.
// 새로 idToken 검증이 필요한 백엔드를 추가하면 이 목록에도 추가할 것.
const TARGET_FILES = [
  "cemetery-backend.gs",
  "community-backend.gs",
  "ihss-backend.gs",
  "member-backend.gs",
  "newsletter-backend.gs",
  "facility-outreach-backend.gs",
];

/** 파일 텍스트에서 "function verifyIdToken(...) { ... }" 블록을
 * 중괄호 짝을 세어 정확히 추출한다. (정규식만으로는 중첩 중괄호를
 * 안전하게 자를 수 없어 이 방식을 쓴다.) */
function extractFunctionBody(source, functionName) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null; // 짝이 맞지 않음 — 파일이 손상되었을 가능성
}

function normalize(text) {
  return text.replace(/\s+/g, ""); // 공백 전부 제거 후 비교
}

function main() {
  const canonicalSource = readFileSync(CANONICAL_PATH, "utf8");
  const canonicalBody = extractFunctionBody(canonicalSource, "verifyIdToken");

  if (!canonicalBody) {
    console.error(`[오류] 정본 파일에서 verifyIdToken 함수를 찾지 못했습니다: ${CANONICAL_PATH}`);
    process.exit(1);
  }

  const canonicalNormalized = normalize(canonicalBody);
  const mismatches = [];
  const missing = [];

  for (const relativePath of TARGET_FILES) {
    const fullPath = join(REPO_ROOT, relativePath);
    let source;
    try {
      source = readFileSync(fullPath, "utf8");
    } catch (_) {
      missing.push(relativePath);
      continue;
    }

    const body = extractFunctionBody(source, "verifyIdToken");
    if (!body) {
      missing.push(relativePath);
      continue;
    }

    if (normalize(body) !== canonicalNormalized) {
      mismatches.push(relativePath);
    }
  }

  if (missing.length === 0 && mismatches.length === 0) {
    console.log(`✅ ${TARGET_FILES.length}개 파일 모두 shared/verify-id-token.gs 정본과 일치합니다.`);
    process.exit(0);
  }

  if (missing.length > 0) {
    console.error("❌ verifyIdToken 함수를 찾지 못한 파일:");
    missing.forEach((f) => console.error(`   - ${f}`));
  }
  if (mismatches.length > 0) {
    console.error("❌ 정본과 내용이 다른 파일 (공백 제외 비교 기준):");
    mismatches.forEach((f) => console.error(`   - ${f}`));
    console.error("\n   shared/verify-id-token.gs 내용을 그대로 복사해 넣고 다시 실행하세요.");
  }
  process.exit(1);
}

main();
