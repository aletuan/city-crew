// Traditional Chinese, as Taiwan writes it, from the Simplified line.
//
// The app's fifth language (21 Oct 2026) is not translated: it is the
// Simplified Chinese already written, put through OpenCC — the converter
// Wikipedia and most Chinese software use — with its Taiwan phrase table
// (`twp`: 软件 → 軟體, 信息 → 資訊, 登录 → 登入), and then through the
// corrections below. A second translation would have been a second set of
// 1,100 strings to keep in step with the first; this is one set, and a
// table of the places where Taiwan's word is not the mainland's word in
// Traditional characters.
//
// `npm run hant` writes the result into every `t()` call as its fifth
// argument, and into every table beside its `zh`. `chinese.test.ts` fails
// when one is not exactly what this file makes of the Simplified, so a
// Simplified line edited later cannot leave its Traditional behind. To
// change a Traditional word, change it here and run `npm run hant` — an
// edit to the fifth argument by hand is undone by the test.
//
// Read before the corrections were written: all 1,072 Chinese strings in
// `src/` as OpenCC left them. What OpenCC's table already does well is
// not repeated here; each line below is a string it got wrong.

import ts from 'typescript';
import * as OpenCC from 'opencc-js/cn2t';

/** Taiwan's word, after OpenCC: [as OpenCC leaves it, as Taiwan says it].
 *  Longest match wins, so a phrase entry outranks the word inside it. */
export const PHRASES: [string, string][] = [
  // An account. 帳 is Taiwan's character for an account; 賬 is the
  // ledger. Mail is 電子郵件; 郵箱 is a postbox.
  ['賬號', '帳號'],
  ['電子郵箱', '電子郵件'],
  ['郵箱地址', '電子郵件地址'],
  ['郵箱', '電子郵件'],
  ['收件箱', '收件匣'],
  ['請查收郵件', '請查看電子郵件'],
  ['查詢驗證碼', '查看驗證碼'],
  ['退出登入', '登出'],
  ['重置', '重設'],
  ['獲取', '取得'],
  ['發送', '傳送'],
  ['個人主頁', '個人檔案'],
  ['頭像', '大頭貼'],
  ['個性化', '個人化'],
  ['隱私政策', '隱私權政策'],
  // Leaving a trip. 退出 is what a program does; a person leaves.
  ['退出', '離開'],
  // The app. Taiwan says App, in Latin letters, with a space beside
  // Chinese; 應用 alone reads as "application" of a rule. A filter that
  // has been applied is 套用.
  ['已應用', '已套用'],
  ['重新開啟應用', '重新開啟 App'],
  ['開啟應用時', '開啟 App 時'],
  ['本應用', '本 App'],
  ['應用的其他部分', 'App 的其他部分'],
  ['熟悉應用', '熟悉 App'],
  ['編輯應用中', '編輯 App 中'],
  ['應用', 'App'],
  // Review. OpenCC's Taiwan table turns 審核 into 稽核, which is an
  // audit — of accounts, of a company. A place waiting on the desk is
  // 待審核 in Taiwan, as an app waits on App Store 審核 (23 Oct 2026).
  ['稽核', '審核'],
  // The screen and its controls.
  ['全屏', '全螢幕'],
  ['標籤頁', '分頁'],
  ['拖動', '拖曳'],
  ['裁剪', '裁切'],
  ['關鍵詞', '關鍵字'],
  ['當前', '目前'],
  ['新建', '新增'],
  ['計劃', '計畫'],
  ['無法撤銷', '無法復原'],
  ['中撤銷', '中取消'],
  ['反饋', '回饋'],
  ['訪問', '存取'],
  ['通過使用者', '透過使用者'],
  ['釋出', '發布'],
  ['點贊', '按讚'],
  ['點讚', '按讚'],
  ['個贊', '個讚'],
  // OpenCC's programmer's words, where the sentence is not about code:
  // 型別 is a data type, 位址列 a browser's address bar.
  ['型別', '類型'],
  ['位址列', '搜尋欄'],
  ['搜索', '搜尋'],
  // 匹配 is the mainland's "match"; Taiwan says 符合. The badge reads
  // better as a choice than as a match.
  ['最佳匹配', '最佳選擇'],
  ['匹配的', '相符的'],
  ['匹配', '符合'],
  // 并 split into 並 ("and") and 併 ("merge"); OpenCC took the second.
  ['併為', '並為'],
  // A restaurant's menu is 菜單; 選單 is a menu on a screen. These are
  // the photographs of menus and signs.
  ['選單與招牌', '菜單與招牌'],
  ['招牌和選單', '招牌和菜單'],
  ['選單或招牌', '菜單或招牌'],
  // Places and people.
  ['天台', '頂樓'],
  ['露臺', '露台'],
  ['帶娃', '帶小孩'],
  ['考拉', '無尾熊'],
  ['本地嚮導', '在地嚮導'],
  ['哪兒', '哪裡'],
  // Food, from the places' blurbs (read 21 Oct 2026, all 257 of them):
  // the mainland's names for what Taiwan calls otherwise, and 自制
  // ("self-restraint") where the blurb meant 自製, made in house.
  ['牛油果', '酪梨'],
  ['三文魚', '鮭魚'],
  ['芝士', '起司'],
  ['酸奶', '優格'],
  ['意麵', '義大利麵'],
  ['自制', '自製'],
  ['酒店', '飯店'],
  ['幹玉米', '乾玉米'],
  // Quotation marks: Taiwan writes 「」, not “”.
  ['“', '「'],
  ['”', '」'],
];

/**
 * The catalog's own words, after the above: a place's blurb, a city's
 * hero. Not the interface, where the same characters mean something
 * else. 選單 is a menu on a screen and the interface has three; every
 * 選單 in a blurb was a restaurant's, 菜單 (12 of 257). 視窗 is a
 * program's window; a blurb's was in a wall. 通過 and 連線 are a test
 * passed and a network joined; a blurb means "by way of" and "linking".
 *
 * Then three OpenCC split wrongly in the blurbs re-translated on 21 Oct
 * (one each in 65): 干 as 幹 where the leaves were pressed dry, 摆 as the
 * 襬 of a hem where plants were set out, 面 as a face where it was
 * linguine. And two places Taiwan names otherwise than the mainland, as
 * `_shared/latinNames.ts` lists them: 峇里島 and 拿坡里.
 *
 * 調變 is a signal modulated, Taiwan's engineering word for 调制; in
 * three cocktail bars' blurbs (21 Oct, of 257) it was drinks mixed, 調製.
 */
export const CATALOG: [string, string][] = [
  ['選單', '菜單'],
  ['視窗', '窗口'],
  ['通過', '透過'],
  ['連線', '連接'],
  ['壓幹', '壓乾'],
  ['下襬放', '下擺放'],
  ['扁面', '扁麵'],
  ['巴厘島', '峇里島'],
  ['巴釐', '峇里'],
  ['那不勒斯', '拿坡里'],
  ['調變', '調製'],
];

const s2twp = OpenCC.Converter({ from: 'cn', to: 'twp' });
const correct = OpenCC.CustomConverter(PHRASES);
const catalog = OpenCC.CustomConverter(CATALOG);

/** The Traditional of a Simplified string, as this app writes it. */
export function toHant(simplified: string): string {
  return correct(s2twp(simplified));
}

/**
 * The same, for the catalog's text: what `toHant` makes of it, with the
 * catalog's words on top.
 *
 * The places' Traditional blurbs (21 Oct 2026) are their Simplified ones
 * put through this, not translated a second time. `write-blurb` was
 * asked first, from the English, and the first three drafts it wrote
 * turned Long Hai into 長海: a place name translated, which is the one
 * thing the owner's rule for Chinese forbids. The Simplified it already
 * wrote said Long Hai, and a converter cannot invent a name. The desk's
 * Draft ZH-HANT button still asks the model, for a place with no
 * Simplified to convert; an editor reads that draft before it is saved.
 */
export function toHantCatalog(simplified: string): string {
  return catalog(toHant(simplified));
}

const HAN = /[\u4e00-\u9fff]/;

const named = (p: ts.ObjectLiteralElementLike, name: string): p is ts.PropertyAssignment =>
  ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name;

/**
 * A table spelled in Chinese — `{ en, vi, ja, zh }` — as its `zh` and its
 * `hant`, or null for any other object. One keyed by language code is not
 * one: a locale table has no Chinese in its `zh` ('zh-Hans-CN'), and a
 * table of labels keyed by `Lang` has its Traditional under 'zh-Hant'.
 */
export function chineseTable(node: ts.ObjectLiteralExpression):
  { zh: ts.Expression; hant: ts.Expression | undefined } | null {
  const zh = node.properties.find((p) => named(p, 'zh'));
  if (!zh) return null;
  const text = zh.initializer;
  if (!ts.isStringLiteral(text) && !ts.isNoSubstitutionTemplateLiteral(text) && !ts.isTemplateExpression(text)) return null;
  if (!HAN.test(text.getText())) return null;
  if (node.properties.some((p) => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name) && p.name.text === 'zh-Hant')) return null;
  return { zh: text, hant: node.properties.find((p) => named(p, 'hant'))?.initializer };
}

const isT = (n: ts.Node): n is ts.CallExpression =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't';

/**
 * What a `t()` call's fifth argument must be, as source, given its
 * fourth; or what a table's `hant` must be given its `zh`.
 *
 * A string is converted as it is written, quotes and `${…}` and all —
 * OpenCC touches only Chinese characters — except for a `t()` call
 * nested inside it, which is copied as it stands: that call answers in
 * Traditional by itself, and converting it would convert its Japanese.
 * Anything else is the Simplified field's Traditional neighbour by name:
 * `c.zh` is `c.hant`, `hero_title_zh` is `hero_title_zh_hant`.
 */
export function hantOf(node: ts.Expression): string {
  const text = node.getText();
  if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node) && !ts.isTemplateExpression(node)) {
    return text.replace(/_zh$/, '_zh_hant').replace(/(^|\.)zh$/, '$1hant');
  }
  const start = node.getStart();
  const nested: [number, number][] = [];
  const find = (n: ts.Node) => {
    if (isT(n)) nested.push([n.getStart() - start, n.getEnd() - start]);
    else ts.forEachChild(n, find);
  };
  ts.forEachChild(node, find);
  let out = '';
  let at = 0;
  for (const [from, to] of nested) {
    out += toHant(text.slice(at, from)) + text.slice(from, to);
    at = to;
  }
  return out + toHant(text.slice(at));
}
