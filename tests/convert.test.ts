import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS,
  type UnitId,
  convert,
  formatResult,
  formatCopy,
  formatForInput,
} from '../src/convert.js';

// 相対誤差 1e-9 以内を確認するヘルパー
function assertClose(actual: number, expected: number, rel = 1e-9): void {
  assert.ok(
    Number.isFinite(actual),
    `有限値であるべき: actual=${actual}`,
  );
  const diff = Math.abs(actual - expected);
  const tol = rel * Math.abs(expected);
  assert.ok(
    diff <= tol,
    `|${actual} - ${expected}| = ${diff} > ${tol}`,
  );
}

// --- 換算の受け入れ基準（SPEC §8） ----------------------------------------
const cases: Array<[number, UnitId, UnitId, number]> = [
  [1, 'Eh', 'eV', 27.211386245981],
  [1, 'Eh', 'kcal', 627.509474063],
  [1, 'Eh', 'cm', 219474.631363],
  [1, 'eV', 'kcal', 23.060547830619],
  [1, 'eV', 'kJ', 96.485332123],
  [1, 'eV', 'cm', 8065.543937349],
  [1, 'eV', 'nm', 1239.841984332],
  [1, 'eV', 'K', 11604.518121550],
  [1, 'kcal', 'kJ', 4.184],
  [298, 'K', 'eV', 0.025679653121],
];

for (const [value, from, to, expected] of cases) {
  test(`${value} ${from} → ${to} = ${expected}`, () => {
    assertClose(convert(value, from, to), expected);
  });
}

// --- 往復（A → B → A で元に戻る） -----------------------------------------
test('任意の単位 A → B → A は元の値に戻る', () => {
  const x = 3.14159; // 正の値（nm でも有効）
  for (const a of UNITS) {
    for (const b of UNITS) {
      const there = convert(x, a.id, b.id);
      const back = convert(there, b.id, a.id);
      assertClose(back, x);
    }
  }
});

// --- nm の不正入力は NaN --------------------------------------------------
test('0 nm・-1 nm → 任意単位 は NaN', () => {
  for (const to of UNITS) {
    assert.ok(Number.isNaN(convert(0, 'nm', to.id)), `0 nm → ${to.id}`);
    assert.ok(Number.isNaN(convert(-1, 'nm', to.id)), `-1 nm → ${to.id}`);
  }
});

test('負エネルギー → nm は NaN（波長が定義できない）', () => {
  assert.ok(Number.isNaN(convert(-1, 'eV', 'nm')));
  // 負エネルギーは nm 以外では許可
  assert.ok(Number.isFinite(convert(-1, 'eV', 'kcal')));
});

// --- 表示フォーマット（formatResult） -------------------------------------
test('formatResult: 0 は "0"', () => {
  assert.equal(formatResult(0), '0');
});

test('formatResult: 換算不能は "—"', () => {
  assert.equal(formatResult(NaN), '—');
  assert.equal(formatResult(Infinity), '—');
});

test('formatResult: 有効数字 8 桁・末尾 0 省略', () => {
  assert.equal(formatResult(1239.841984332), '1239.842');
  assert.equal(formatResult(4.184), '4.184');
  assert.equal(formatResult(123456.78), '123456.78');
});

test('formatResult: 指数表記の境界（1e-4 未満 / 1e6 以上）', () => {
  // 1e-4 ちょうどは固定表記
  assert.equal(formatResult(1e-4), '0.0001');
  // 1e-4 未満は指数（上付き）
  assert.equal(formatResult(5e-5), '5 × 10⁻⁵');
  // 1e6 ちょうどは指数
  assert.equal(formatResult(1e6), '1 × 10⁶');
  // 1e6 未満は固定
  assert.equal(formatResult(999999), '999999');
});

test('formatResult: 指数の仮数も 8 桁・末尾 0 省略', () => {
  assert.equal(formatResult(1.2e-5), '1.2 × 10⁻⁵');
});

// --- 表示フォーマット（formatCopy） ---------------------------------------
test('formatCopy: 最大 10 桁・末尾 0 省略・プレーン数値', () => {
  assert.equal(formatCopy(1239.841984332), '1239.841984');
  assert.equal(formatCopy(4.184), '4.184');
  assert.equal(formatCopy(0), '0');
  assert.equal(formatCopy(1.23456789e-5), '1.23456789e-5');
});

test('formatCopy: 換算不能は空文字', () => {
  assert.equal(formatCopy(NaN), '');
});

// --- 入れ替え用フォーマット（formatForInput） -----------------------------
test('formatForInput: 8 桁・再パース可能な e 表記', () => {
  assert.equal(formatForInput(1239.841984332), '1239.842');
  assert.equal(formatForInput(5e-5), '5e-5');
  // 往復でパースできること
  assert.equal(Number(formatForInput(5e-5)), 5e-5);
});
