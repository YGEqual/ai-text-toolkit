/* humanizer.js — 去 AI 化（降低 AI 写作痕迹，中英文，纯本地规则引擎）
 * 手段：去套话/过渡词、破折号口语化、句长起伏（拆长句）、同义词替换。
 * 确定性输出（不依赖随机），可重复。结果建议人工复核。
 */
(function (global) {
  'use strict';

  // [匹配, 替换]；按顺序应用。空串=删除。
  const CLICHE_ZH = [
    [/综上所述[，,]?/g, ''], [/总而言之[，,]?/g, ''], [/总的来说[，,]?/g, ''],
    [/值得注意的是[，,]?/g, ''], [/值得一提的是[，,]?/g, ''], [/需要注意的是[，,]?/g, ''],
    [/不难发现[，,]?/g, ''], [/众所周知[，,]?/g, ''], [/由此可见[，,]?/g, ''],
    [/首先[，,]/g, ''], [/其次[，,]/g, ''], [/再次[，,]/g, ''], [/最后[，,]/g, ''],
    [/一方面[，,]?/g, ''], [/另一方面[，,]?/g, ''], [/与此同时[，,]?/g, '同时'],
    [/在当今社会[，,]?/g, '现在'], [/在当今[，,]?/g, '现在'],
    [/扮演着重要角色/g, '很关键'], [/发挥着重要作用/g, '很有用'],
    [/具有重要意义/g, '很有意义'], [/至关重要/g, '很重要'],
    [/赋能/g, '帮助'], [/助力/g, '帮'], [/旨在/g, '是为了'],
  ];
  const CLICHE_EN = [
    [/\bit is important to note that\b/gi, ''], [/\bit'?s important to note that\b/gi, ''],
    [/\bit is worth noting that\b/gi, ''], [/\bin conclusion,?\b/gi, ''],
    [/\bin summary,?\b/gi, ''], [/\bto sum up,?\b/gi, ''],
    [/\bdelve into\b/gi, 'explore'], [/\bdelve\b/gi, 'explore'],
    [/\bplays a (crucial|vital|significant|key) role\b/gi, 'matters'],
    [/\bin the realm of\b/gi, 'in'], [/\bin today'?s world,?\b/gi, 'today'],
    [/\bnavigate the\b/gi, 'handle the'], [/\ba testament to\b/gi, 'a sign of'],
    [/\bcutting-edge\b/gi, 'advanced'], [/\bseamlessly\b/gi, 'smoothly'],
    [/\bembark on\b/gi, 'start'], [/\bunlock the\b/gi, 'open up the'],
  ];

  const SYN_ZH = [
    [/非常/g, '很'], [/十分/g, '很'], [/卓越/g, '出色'], [/显著/g, '明显'],
    [/诸多/g, '很多'], [/众多/g, '很多'], [/目前/g, '现在'], [/然而/g, '但'],
    [/因此/g, '所以'], [/此外/g, '另外'], [/从而/g, '进而'], [/能够/g, '能'],
  ];
  const SYN_EN = [
    [/\butilize\b/gi, 'use'], [/\bleverage\b/gi, 'use'], [/\bfurthermore\b/gi, 'also'],
    [/\bmoreover\b/gi, 'also'], [/\badditionally\b/gi, 'also'], [/\bin order to\b/gi, 'to'],
    [/\ba number of\b/gi, 'several'], [/\bnumerous\b/gi, 'many'], [/\bcommence\b/gi, 'start'],
    [/\bdemonstrate\b/gi, 'show'], [/\bfacilitate\b/gi, 'help'], [/\bapproximately\b/gi, 'about'],
    [/\bsubsequently\b/gi, 'then'], [/\bnevertheless\b/gi, 'still'], [/\btherefore\b/gi, 'so'],
  ];

  function detectLang(text) {
    const zh = (text.match(/[一-鿿]/g) || []).length;
    return zh / Math.max(1, text.length) > 0.2 ? 'zh' : 'en';
  }

  function apply(text, pairs, log, label) {
    let n = 0;
    for (const [pat, rep] of pairs) {
      text = text.replace(pat, () => { n++; return rep; });
    }
    if (n > 0) log.push({ label, n });
    return text;
  }

  function cleanPunct(text, lang) {
    if (lang === 'zh') {
      text = text.replace(/[，。、；：]{2,}/g, m => m[0]);   // 重复标点
      text = text.replace(/^[，。、；：\s]+/gm, '');         // 行首悬空标点
    } else {
      text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,;!?])/g, '$1');
      text = text.replace(/([.!?])\s*\1+/g, '$1');
    }
    return text.trim();
  }

  // 破折号口语化
  function deDash(text, lang, log) {
    let n = 0;
    text = text.replace(/\s*[—–]{1,2}\s*/g, () => { n++; return lang === 'zh' ? '，' : ', '; });
    text = text.replace(/\s*--\s*/g, () => { n++; return lang === 'zh' ? '，' : ', '; });
    if (n > 0) log.push({ label: '破折号口语化', n });
    return text;
  }

  // 拆长句以制造句长起伏（提升 burstiness）
  function adjustBurst(text, lang, strength, log) {
    const thr = lang === 'zh'
      ? { light: 60, medium: 46, strong: 36 }[strength]
      : { light: 36, medium: 28, strong: 22 }[strength];
    let n = 0;
    const splitter = lang === 'zh' ? /(?<=[。！？])/ : /(?<=[.!?])\s/;
    const sentences = text.split(splitter);
    const out = sentences.map(s => {
      const len = lang === 'zh' ? (s.match(/[一-鿿]/g) || []).length : s.split(/\s+/).length;
      if (len <= thr) return s;
      // 在靠近中部的逗号处断句
      const commaRe = lang === 'zh' ? /，/g : /, /g;
      const idxs = []; let m;
      while ((m = commaRe.exec(s))) idxs.push(m.index);
      if (!idxs.length) return s;
      const mid = idxs.reduce((a, b) => Math.abs(b - s.length / 2) < Math.abs(a - s.length / 2) ? b : a);
      n++;
      if (lang === 'zh') return s.slice(0, mid) + '。' + s.slice(mid + 1);
      return s.slice(0, mid) + '. ' + s.slice(mid + 2, mid + 3).toUpperCase() + s.slice(mid + 3);
    });
    if (n > 0) log.push({ label: '拆分长句', n });
    return out.join(lang === 'zh' ? '' : ' ').replace(/\s{2,}/g, ' ');
  }

  function humanize(rawText, opts) {
    opts = opts || {};
    const strength = opts.strength || 'medium';
    let text = (rawText || '').trim();
    const lang = detectLang(text);
    const log = [];

    if (opts.removeCliche !== false)
      text = apply(text, lang === 'zh' ? CLICHE_ZH : CLICHE_EN, log, '去套话/过渡词');
    if (opts.dash !== false)
      text = deDash(text, lang, log);
    if (opts.synonym !== false) {
      const syn = lang === 'zh' ? SYN_ZH : SYN_EN;
      // 强度控制覆盖比例
      const ratio = { light: 0.4, medium: 0.7, strong: 1 }[strength];
      const used = syn.slice(0, Math.ceil(syn.length * ratio));
      text = apply(text, used, log, '同义词替换');
    }
    if (opts.burst !== false)
      text = adjustBurst(text, lang, strength, log);

    text = cleanPunct(text, lang);
    return { output: text, lang, changes: log };
  }

  global.Humanizer = { humanize, detectLang };
})(window);
