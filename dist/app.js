// UI 処理。換算ロジックは convert.ts（DOM 非依存）に委譲する。
import { UNITS, toEv, fromEv, formatResult, formatCopy, formatForInput, unitLabel, } from './convert.js';
// --- 入力の分類 ------------------------------------------------------------
// 完全な数値：整数・小数・指数表記（1.5, -0.3, 2e-3, .5 など）
const FULL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
// 入力途中（あとから数字が続きうる形：末尾が e / e- / - / . など）
const PARTIAL = /^[+-]?(\d+\.?\d*|\.\d*)?([eE][+-]?\d*)?$/;
function classify(raw) {
    const s = raw.trim();
    if (s === '')
        return { kind: 'empty' };
    if (FULL.test(s)) {
        const n = Number(s);
        if (Number.isFinite(n))
            return { kind: 'number', value: n };
        return { kind: 'error' };
    }
    if (PARTIAL.test(s))
        return { kind: 'partial' };
    return { kind: 'error' };
}
// --- DOM 参照 --------------------------------------------------------------
function el(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`要素が見つかりません: #${id}`);
    return node;
}
const input = el('value-input');
const fromUnitLabel = el('from-unit-label');
const toUnitLabel = el('to-unit-label');
const errorEl = el('input-error');
const resultValueEl = el('result-value');
const copyBtn = el('copy-btn');
const swapBtn = el('swap-btn');
const fromGroup = el('from-units');
const toGroup = el('to-units');
const descEl = el('descriptions');
const COPY_LABEL = 'コピー';
const COPIED_LABEL = 'コピー済み';
let copiedTimer;
// --- 状態 ------------------------------------------------------------------
const state = {
    fromUnit: 'eV',
    toUnit: 'nm',
};
// --- 単位ボタンの生成 ------------------------------------------------------
function buildUnitButtons(group, side) {
    for (const u of UNITS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'unit-btn';
        btn.textContent = u.label;
        btn.dataset.unit = u.id;
        btn.addEventListener('click', () => {
            if (side === 'from')
                state.fromUnit = u.id;
            else
                state.toUnit = u.id;
            render();
        });
        group.appendChild(btn);
    }
}
function syncUnitButtons() {
    for (const btn of Array.from(fromGroup.children)) {
        const active = btn.dataset.unit === state.fromUnit;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    }
    for (const btn of Array.from(toGroup.children)) {
        const active = btn.dataset.unit === state.toUnit;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    }
}
// --- 説明欄 ----------------------------------------------------------------
function addDesc(title, body) {
    const p = document.createElement('p');
    p.className = 'desc-item';
    const strong = document.createElement('span');
    strong.className = 'desc-title';
    strong.textContent = `${title}：`;
    p.appendChild(strong);
    p.appendChild(document.createTextNode(body));
    descEl.appendChild(p);
}
function renderDescriptions(nmNote) {
    descEl.replaceChildren();
    const from = UNITS.find((u) => u.id === state.fromUnit);
    const to = UNITS.find((u) => u.id === state.toUnit);
    if (state.fromUnit === state.toUnit) {
        addDesc(`${from.label}（変換元・変換先）`, from.desc);
    }
    else {
        addDesc(`${from.label}（変換元）`, from.desc);
        addDesc(`${to.label}（変換先）`, to.desc);
    }
    if (nmNote) {
        const p = document.createElement('p');
        p.className = 'desc-note';
        p.textContent = 'このエネルギー（0 以下）に対応する波長はありません。';
        descEl.appendChild(p);
    }
}
// 現在の入力・単位から換算結果（数値）を得る。換算不能なら null。
function computeResult() {
    const parsed = classify(input.value);
    if (parsed.kind !== 'number')
        return null;
    if (state.fromUnit === 'nm' && parsed.value <= 0)
        return null;
    const ev = toEv(parsed.value, state.fromUnit);
    if (state.toUnit === 'nm' && ev <= 0)
        return null;
    const result = fromEv(ev, state.toUnit);
    return Number.isFinite(result) ? result : null;
}
// --- 描画 ------------------------------------------------------------------
function render() {
    syncUnitButtons();
    fromUnitLabel.textContent = unitLabel(state.fromUnit);
    toUnitLabel.textContent = unitLabel(state.toUnit);
    const parsed = classify(input.value);
    let resultText = '—';
    let errorText = '';
    let copyValue = '';
    let nmNote = false;
    if (parsed.kind === 'number') {
        if (state.fromUnit === 'nm' && parsed.value <= 0) {
            errorText = '波長（nm）は 0 より大きい値を入力してください';
        }
        else {
            const ev = toEv(parsed.value, state.fromUnit);
            if (state.toUnit === 'nm' && ev <= 0) {
                nmNote = true; // 結果は — のまま、理由を説明欄に出す
            }
            else {
                const result = fromEv(ev, state.toUnit);
                resultText = formatResult(result);
                copyValue = formatCopy(result);
            }
        }
    }
    else if (parsed.kind === 'error') {
        errorText = '数値を入力してください（例: 1.5, 2e-3）';
    }
    // empty / partial は 結果 — ・エラーなし
    resultValueEl.textContent = resultText;
    errorEl.textContent = errorText;
    errorEl.hidden = errorText === '';
    input.setAttribute('aria-invalid', String(errorText !== ''));
    copyBtn.disabled = copyValue === '';
    copyBtn.dataset.copy = copyValue;
    renderDescriptions(nmNote);
}
// --- 入れ替え --------------------------------------------------------------
function swap() {
    const result = computeResult();
    [state.fromUnit, state.toUnit] = [state.toUnit, state.fromUnit];
    // 結果が出ているときだけ、表示用 8 桁の丸め値を新しい入力値にする
    if (result !== null) {
        const next = formatForInput(result);
        if (next !== '')
            input.value = next;
    }
    render();
}
// --- コピー ----------------------------------------------------------------
function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
    }
    finally {
        document.body.removeChild(ta);
    }
}
function showCopied() {
    copyBtn.classList.add('is-copied');
    copyBtn.querySelector('.copy-label').textContent = COPIED_LABEL;
    if (copiedTimer)
        clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.querySelector('.copy-label').textContent = COPY_LABEL;
    }, 1500);
}
async function copyResult() {
    const text = copyBtn.dataset.copy ?? '';
    if (text === '')
        return;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        }
        else {
            legacyCopy(text);
        }
        showCopied();
    }
    catch {
        // Clipboard API が使えない環境でも止まらないようにフォールバック
        try {
            legacyCopy(text);
            showCopied();
        }
        catch {
            /* 何もしない（エラーで止めない） */
        }
    }
}
// --- 初期化 ----------------------------------------------------------------
buildUnitButtons(fromGroup, 'from');
buildUnitButtons(toGroup, 'to');
input.addEventListener('input', render);
swapBtn.addEventListener('click', swap);
copyBtn.addEventListener('click', copyResult);
render();
