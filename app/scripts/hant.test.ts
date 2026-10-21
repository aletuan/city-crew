// What `hant.ts` makes of the source, case by case. `chinese.test.ts`
// holds the app to it; this holds it to what it means.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { chineseTable, hantOf, toHant, toHantCatalog } from './hant';

/** The first node of a kind in a snippet, parsed as the app's files are. */
function first<T extends ts.Node>(code: string, is: (n: ts.Node) => n is T): T {
  const sf = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let hit: T | undefined;
  const visit = (n: ts.Node) => { if (!hit && is(n)) hit = n; else ts.forEachChild(n, visit); };
  visit(sf);
  if (!hit) throw new Error('no node');
  return hit;
}

const fourth = (code: string) => first(code, ts.isCallExpression).arguments[3];

describe('toHant', () => {
  it('writes Taiwan\'s words, not the mainland\'s in Traditional characters', () => {
    expect(toHant('软件')).toBe('軟體');
    expect(toHant('输入你的邮箱')).toBe('輸入你的電子郵件');
    expect(toHant('删除账号')).toBe('刪除帳號');
    expect(toHant('退出登录')).toBe('登出');
    expect(toHant('重新打开应用')).toBe('重新開啟 App');
  });

  // Longest match: the phrase entry, not the word inside it.
  it('prefers a phrase to the word inside it', () => {
    expect(toHant('筛选，已应用 3 项')).toBe('篩選，已套用 3 項');
    expect(toHant('最佳匹配')).toBe('最佳選擇');
  });

  it('quotes the way Taiwan does', () => {
    expect(toHant('“周末咖啡”')).toBe('「週末咖啡」');
  });
});

// The catalog's words are the interface's plus its own: 選單 there is a
// screen's menu, here a restaurant's.
describe('toHantCatalog', () => {
  it('writes a restaurant\'s menu as one, and leaves the interface\'s alone', () => {
    expect(toHantCatalog('菜单以早午餐为主')).toBe('菜單以早午餐為主');
    expect(toHant('关闭菜单')).toBe('關閉選單');
    expect(toHantCatalog('请尽早通过其网站下单')).toBe('請儘早透過其網站下單');
    expect(toHant('未通过')).toBe('未通過');
  });

  it('mends what OpenCC split wrongly in a blurb, and names places as Taiwan does', () => {
    expect(toHantCatalog('压干树叶的版画')).toBe('壓乾樹葉的版畫');
    expect(toHantCatalog('屋檐下摆放着植物')).toBe('屋簷下擺放著植物');
    expect(toHantCatalog('海鲜扁面')).toBe('海鮮扁麵');
    expect(toHantCatalog('巴厘岛风格')).toBe('峇里島風格');
    expect(toHantCatalog('来自那不勒斯')).toBe('來自拿坡里');
  });

  it('names food as Taiwan does, in either', () => {
    expect(toHant('牛油果吐司配三文鱼')).toBe('酪梨吐司配鮭魚');
    expect(toHantCatalog('自制意面和芝士')).toBe('自製義大利麵和起司');
  });
});

describe('hantOf', () => {
  it('converts a string as written, quotes and all', () => {
    expect(hantOf(fourth(`t('a', 'b', 'c', '地点')`))).toBe(`'地點'`);
    expect(hantOf(fourth('t(`a`, `b`, `c`, `${n} 个地点`)'))).toBe('`${n} 個地點`');
  });

  // The nested call answers in Traditional by itself; converting it
  // would convert its Japanese — 写真 is not 寫真.
  it('copies a t() call inside the string as it stands', () => {
    const code = "t('a', 'b', 'c', `${t('Photo', 'Ảnh', '写真', '照片', '照片')} 第 ${i} 张`)";
    expect(hantOf(fourth(code))).toBe("`${t('Photo', 'Ảnh', '写真', '照片', '照片')} 第 ${i} 張`");
  });

  it('names the Traditional neighbour of anything that is not a string', () => {
    expect(hantOf(fourth('t(c.en, c.vi, c.ja, c.zh)'))).toBe('c.hant');
    expect(hantOf(fourth('t(en, vi, ja, zh)'))).toBe('hant');
    expect(hantOf(fourth('t(a, b, c, CATEGORIES[k].zh)'))).toBe('CATEGORIES[k].hant');
    expect(hantOf(fourth('t(a, b, c, city.hero_title_zh)'))).toBe('city.hero_title_zh_hant');
  });
});

describe('chineseTable', () => {
  const table = (code: string) => chineseTable(first(code, ts.isObjectLiteralExpression));

  it('finds a table spelled in Chinese, with or without its Traditional', () => {
    expect(table(`({ en: 'Mon', zh: '周一', hant: '週一' })`)?.hant?.getText()).toBe(`'週一'`);
    expect(table(`({ en: 'Mon', zh: '周一' })`)?.zh.getText()).toBe(`'周一'`);
    expect(table(`({ en: 'Mon', zh: '周一' })`)?.hant).toBeUndefined();
  });

  it('passes over a table keyed by language code', () => {
    expect(table(`({ en: 'en-GB', zh: 'zh-Hans-CN' })`)).toBeNull();
    expect(table(`({ en: 'English', zh: '简体中文', 'zh-Hant': '繁體中文' })`)).toBeNull();
    expect(table(`({ en: 'x', zh: someName })`)).toBeNull();
    expect(table(`({ en: 'x' })`)).toBeNull();
  });
});
