// エネルギー単位換算ロジック（ES module、DOM に依存しない）
//
// 内部では eV を基準に換算する。nm だけはエネルギーに反比例する（光子の波長）。
// 換算係数はハードコードせず、下の物理定数から導出する。

// --- 物理定数（CODATA 2022 / SI 定義値） -----------------------------------
export const CONSTANTS = {
  h: 6.62607015e-34, // プランク定数 [J s]（SI 定義値）
  c: 299792458, // 光速 [m/s]（SI 定義値）
  e: 1.602176634e-19, // 電気素量 [C]（SI 定義値）
  kB: 1.380649e-23, // ボルツマン定数 [J/K]（SI 定義値）
  NA: 6.02214076e23, // アボガドロ定数 [mol^-1]（SI 定義値）
  Eh: 4.3597447222060e-18, // ハートリーエネルギー [J]（CODATA 2022）
} as const;

const { h, c, e, kB, NA, Eh } = CONSTANTS;

// nm 換算の比例定数 [eV·nm]： E[eV] = NM_CONST / λ[nm]（λ[nm] = NM_CONST / E[eV]）
export const NM_CONST = (h * c * 1e9) / e;

// 単位 ID
export type UnitId = 'Eh' | 'eV' | 'kcal' | 'kJ' | 'cm' | 'nm' | 'K';

// 1 単位 = (EV_PER[id]) eV となる線形換算係数（nm を除く）
const EV_PER: Record<Exclude<UnitId, 'nm'>, number> = {
  Eh: Eh / e, //  1 Eₕ      = Eₕ[J] / e
  eV: 1, //           基準
  kcal: 4184 / (e * NA), //  1 kcal/mol = 4184 / (e·N_A)
  kJ: 1000 / (e * NA), //    1 kJ/mol   = 1000 / (e·N_A)
  cm: (h * c * 100) / e, //  1 cm⁻¹     = h·c·100 / e
  K: kB / e, //              1 K        = k_B / e
};

export interface Unit {
  id: UnitId;
  label: string;
  desc: string;
}

// --- 単位メタ情報（表示順は SPEC §3 の表どおり） ---------------------------
export const UNITS: readonly Unit[] = [
  {
    id: 'Eh',
    label: 'Hartree',
    desc: '原子単位系のエネルギー単位（Eₕ）。量子化学計算プログラムの出力で標準的に使われます。1 Eₕ ≈ 27.211 eV。',
  },
  {
    id: 'eV',
    label: 'eV',
    desc: '電子ボルト。電子1個が1 Vの電位差で得るエネルギーです。分光や固体物理でよく使われます。',
  },
  {
    id: 'kcal',
    label: 'kcal/mol',
    desc: '1分子あたりのエネルギーにアボガドロ定数を掛けたモルあたりの値です。反応エネルギーや活性化エネルギーでよく使われます。1 cal = 4.184 J（熱化学カロリー）。',
  },
  {
    id: 'kJ',
    label: 'kJ/mol',
    desc: 'モルあたりのエネルギーのSI単位です。熱化学データやMDの力場パラメータでよく使われます。',
  },
  {
    id: 'cm',
    label: 'cm⁻¹',
    desc: '波数（波長の逆数）。エネルギーに比例し、赤外・ラマン分光の振動数の表記に使われます。',
  },
  {
    id: 'nm',
    label: 'nm',
    desc: 'エネルギーの単位ではなく、そのエネルギーを持つ光子の波長として換算しています（E = hc/λ）。エネルギーとは反比例し、0 以下の値は換算できません。UV-Visの吸収波長などに使えます。',
  },
  {
    id: 'K',
    label: 'K',
    desc: 'E = k_BT による温度換算です。熱エネルギーの目安として使ってください（室温 298 K ≈ 0.0257 eV）。',
  },
];

const UNIT_IDS = new Set<string>(UNITS.map((u) => u.id));

export function isUnit(id: string): id is UnitId {
  return UNIT_IDS.has(id);
}

export function unitLabel(id: UnitId): string {
  const u = UNITS.find((x) => x.id === id);
  return u ? u.label : id;
}

// --- 換算 ------------------------------------------------------------------

// 指定単位の値を eV に変換する。nm で 0 以下の入力は換算不能なので NaN。
export function toEv(value: number, unit: UnitId): number {
  if (!Number.isFinite(value)) return NaN;
  if (unit === 'nm') {
    if (value <= 0) return NaN;
    return NM_CONST / value;
  }
  return value * EV_PER[unit];
}

// eV を指定単位に変換する。nm はエネルギーが 0 以下だと波長が定義できないので NaN。
export function fromEv(ev: number, unit: UnitId): number {
  if (!Number.isFinite(ev)) return NaN;
  if (unit === 'nm') {
    if (ev <= 0) return NaN;
    return NM_CONST / ev;
  }
  return ev / EV_PER[unit];
}

// 変換元 → 変換先。換算不能な場合は NaN を返す。
export function convert(value: number, fromUnit: UnitId, toUnit: UnitId): number {
  return fromEv(toEv(value, fromUnit), toUnit);
}

// --- 表示フォーマット ------------------------------------------------------

// 上付き数字（指数表記用）
const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join('');
}

// 末尾の 0（と余った小数点）を取り除く
function stripZeros(s: string): string {
  if (s.indexOf('.') === -1) return s;
  return s.replace(/\.?0+$/, '');
}

// 指数表記かどうかの判定（絶対値が 1e6 以上、または 1e-4 未満）
function needsExponent(abs: number): boolean {
  return abs >= 1e6 || abs < 1e-4;
}

// 画面表示用。有効数字 8 桁、末尾 0 省略。指数は上付き文字。0 は "0"。
// 換算不能（NaN 等）は "—"。
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (needsExponent(abs)) {
    const [mant, exp] = value.toExponential(7).split('e');
    return `${stripZeros(mant)} × 10${toSuperscript(parseInt(exp, 10))}`;
  }
  return stripZeros(value.toPrecision(8));
}

// コピー用。有効数字 最大 10 桁の末尾 0 を省いたプレーン数値（Python/Excel 貼り付け可）。
// 換算不能は空文字。
export function formatCopy(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (needsExponent(abs)) {
    const [mant, exp] = value.toExponential(9).split('e');
    return `${stripZeros(mant)}e${parseInt(exp, 10)}`;
  }
  return stripZeros(value.toPrecision(10));
}

// 入れ替え時に入力欄へ入れる値。表示用 8 桁の丸め値を、再パース可能な形で返す
// （指数は上付きではなく e 表記にする）。換算不能は空文字。
export function formatForInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (needsExponent(abs)) {
    const [mant, exp] = value.toExponential(7).split('e');
    return `${stripZeros(mant)}e${parseInt(exp, 10)}`;
  }
  return stripZeros(value.toPrecision(8));
}
