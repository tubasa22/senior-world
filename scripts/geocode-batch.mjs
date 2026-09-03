import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CENSUS_BATCH_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const indexPath = path.join(projectRoot, 'index.html');
const backupPath = path.join(projectRoot, 'index.html.bak');
const laDataPath = path.join(projectRoot, 'data', 'la-apartments-2026-08.json');

const dataBlockPattern =
  /\/\* __DATA__ \*\/([\s\S]*?)\/\* __END_DATA__ \*\//;
const apartmentsPattern = /const APARTMENTS\s*=\s*(\[[\s\S]*\]);/;
const preciseBlockPattern =
  /\/\* __PRECISE_START__ \*\/[\s\S]*?\/\* __PRECISE_END__ \*\//;
const preciseDataPattern =
  /\/\* __PRECISE_START__ \*\/\s*const BAKED_PRECISE\s*=\s*([\s\S]*?);\s*\/\* __PRECISE_END__ \*\//;

function csvField(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('응답 CSV의 큰따옴표가 닫히지 않았습니다.');
  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

const html = await readFile(indexPath, 'utf8');
const dataBlock = html.match(dataBlockPattern);
if (!dataBlock) throw new Error('index.html에서 __DATA__ 블록을 찾지 못했습니다.');

const apartmentsMatch = dataBlock[1].match(apartmentsPattern);
if (!apartmentsMatch) throw new Error('__DATA__ 블록에서 APARTMENTS 배열을 찾지 못했습니다.');

// TODO: APARTMENTS가 data/apartments.json으로 분리되면 이 파일을 직접 읽도록 변경한다.
const ocApartments = JSON.parse(apartmentsMatch[1]);
const laApartments = JSON.parse(await readFile(laDataPath, 'utf8'));
const apartments = [...ocApartments, ...laApartments];
const apartmentById = new Map(apartments.map((apt) => [String(apt.id), apt]));

const preciseMatch = html.match(preciseDataPattern);
if (!preciseMatch) throw new Error('index.html에서 __PRECISE__ 블록을 찾지 못했습니다.');
const existingPrecise = JSON.parse(preciseMatch[1]);

const addressCsv = apartments
  .map((apt) => [apt.id, apt.address, apt.city, 'CA', apt.zip].map(csvField).join(','))
  .join('\n');

const form = new FormData();
form.append('addressFile', new Blob([addressCsv], { type: 'text/csv' }), 'addresses.csv');
form.append('benchmark', 'Public_AR_Current');

const response = await fetch(CENSUS_BATCH_URL, { method: 'POST', body: form });
if (!response.ok) {
  throw new Error(`Census Batch Geocoder 요청 실패: ${response.status} ${response.statusText}`);
}

const rows = parseCsv(await response.text());
const matched = {};
const successfulIds = new Set();

for (const row of rows) {
  const [rawId, , matchStatus, matchType, , coordinates] = row;
  const id = rawId?.replace(/^\uFEFF/, '');
  const apt = apartmentById.get(id);
  if (!apt) continue;

  if (matchStatus === 'Match' && ['Exact', 'Non_Exact'].includes(matchType)) {
    const [longitude, latitude] = (coordinates ?? '').split(',').map(Number);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      matched[apt.fullAddress] = { lat: latitude, lon: longitude };
      successfulIds.add(id);
    }
  }
}

const failures = apartments.filter((apt) => !successfulIds.has(String(apt.id)));
const mergedPrecise = Object.assign({}, existingPrecise, matched);
const newline = html.includes('\r\n') ? '\r\n' : '\n';
const preciseBlock = [
  '/* __PRECISE_START__ */',
  `const BAKED_PRECISE = ${JSON.stringify(mergedPrecise)};`,
  '/* __PRECISE_END__ */',
].join(newline);
const updatedHtml = html.replace(preciseBlockPattern, preciseBlock);

await copyFile(indexPath, backupPath);
await writeFile(indexPath, updatedHtml, 'utf8');

console.log(`총 ${apartments.length}건 중 매칭 성공 ${successfulIds.size}건, 실패 ${failures.length}건`);
if (failures.length > 0) {
  console.log('실패한 주소 목록:');
  for (const apt of failures) {
    console.log(`- id ${apt.id}: ${apt.name} — ${apt.address}`);
  }
}
