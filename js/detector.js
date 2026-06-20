/* detector.js — 文本 AI 生成率启发式检测（中英文，纯本地）
 * 思路（综合多个开源检测器的公开特征）：
 *   M1 AI 套话/模板词密度
 *   M2 句长突发性缺失（人类写作句长起伏大，AI 偏均匀 —— burstiness）
 *   M3 过渡/连接词密度（AI 偏爱 然而/因此/综上 / however/moreover…）
 *   M4 结构整齐度（排比、列表、标点均匀）
 * 综合加权得到 0-100 的 AI 生成率估计。结果为概率估计，仅供参考。
 */
(function (global) {
  'use strict';

  // ---- 套话 / 模板短语库 ----
  const CLICHES_ZH = [
    '综上所述', '总而言之', '总的来说', '总之', '值得注意的是', '值得一提的是',
    '需要注意的是', '不难发现', '众所周知', '在当今', '在当今社会', '随着',
    '的不断发展', '的快速发展', '扮演着重要角色', '发挥着重要作用', '起着至关重要',
    '至关重要', '不可或缺', '深入探讨', '深入了解', '旨在', '从而', '进而',
    '赋能', '助力', '抓手', '闭环', '颗粒度', '首先', '其次', '再次', '最后',
    '一方面', '另一方面', '不仅', '而且', '此外', '除此之外', '与此同时',
    '在这个', '的时代', '让我们', '共同', '携手', '迈向', '崭新', '蓬勃发展',
    '日新月异', '层出不穷', '应运而生', '具有重要意义', '提供了有力',
  ];
  const CLICHES_EN = [
    'delve into', 'delve', 'tapestry', 'in conclusion', 'in summary', 'to sum up',
    'it is important to note', 'it is worth noting', "it's important to note",
    'plays a crucial role', 'plays a vital role', 'plays a significant role',
    'in today\'s world', 'in the realm of', 'realm of', 'navigate the',
    'leverage', 'underscore', 'underscores', 'a testament to', 'testament',
    'boast', 'boasts', 'foster', 'fostering', 'seamless', 'seamlessly',
    'cutting-edge', 'game-changer', 'unlock the', 'unleash', 'embark on',
    'at the end of the day', 'when it comes to', 'in the world of',
    'ever-evolving', 'ever-changing', 'multifaceted', 'holistic', 'robust',
    'pivotal', 'paramount', 'crucial', 'vital', 'comprehensive', 'furthermore',
    'moreover', 'additionally', 'consequently', 'nevertheless', 'notably',
  ];
  const CONNECTORS_ZH = ['然而', '因此', '所以', '但是', '不过', '此外', '另外',
    '同时', '其次', '首先', '最后', '总之', '因而', '故而', '换言之', '也就是说',
    '由此可见', '综上', '进而', '从而', '与此同时', '反之', '相反', '尽管如此'];
  const CONNECTORS_EN = ['however', 'therefore', 'thus', 'moreover', 'furthermore',
    'additionally', 'consequently', 'nevertheless', 'nonetheless', 'meanwhile',
    'hence', 'accordingly', 'subsequently', 'in addition', 'on the other hand',
    'as a result', 'in contrast', 'firstly', 'secondly', 'finally', 'notably'];

  function detectLang(text) {
    const zh = (text.match(/[一-鿿]/g) || []).length;
    return zh / Math.max(1, text.length) > 0.2 ? 'zh' : 'en';
  }

  function splitSentences(text, lang) {
    let parts;
    if (lang === 'zh') parts = text.split(/[。！？；\n]+/);
    else parts = text.split(/(?<=[.!?])\s+|\n+/);
    return parts.map(s => s.trim()).filter(s => s.length > 0);
  }

  function sentenceLen(s, lang) {
    if (lang === 'zh') return (s.match(/[一-鿿]/g) || []).length || s.length;
    return s.split(/\s+/).filter(Boolean).length;
  }

  // 变异系数 → AI 概率（CV 越低越像 AI）
  function burstinessScore(lens) {
    if (lens.length < 3) return { ai: 0.3, cv: null, lowConf: true };
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    if (mean === 0) return { ai: 0.3, cv: 0, lowConf: true };
    const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
    const cv = Math.sqrt(variance) / mean;
    const ai = clamp((0.72 - cv) / 0.6, 0, 1); // CV0.12→1, CV0.72→0
    return { ai, cv, lowConf: false };
  }

  function countHits(lowerText, list) {
    const hits = [];
    for (const w of list) {
      let idx = 0, c = 0;
      while ((idx = lowerText.indexOf(w, idx)) !== -1) { c++; idx += w.length; }
      if (c > 0) hits.push({ w, c });
    }
    return hits;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // 排比 / 整齐结构：相邻句首词重复 + 句长接近
  function structureScore(sentences, lens, lang) {
    if (sentences.length < 3) return 0.2;
    let parallel = 0;
    const head = s => lang === 'zh' ? s.slice(0, 2) : (s.split(/\s+/)[0] || '').toLowerCase();
    for (let i = 1; i < sentences.length; i++) {
      if (head(sentences[i]) && head(sentences[i]) === head(sentences[i - 1])) parallel++;
    }
    const parallelRate = parallel / sentences.length;
    // 句长接近度：相邻句长差很小 → 整齐
    let close = 0;
    for (let i = 1; i < lens.length; i++) {
      const a = lens[i], b = lens[i - 1];
      if (a && b && Math.abs(a - b) / Math.max(a, b) < 0.2) close++;
    }
    const closeRate = close / lens.length;
    return clamp(parallelRate * 2 + closeRate * 0.8, 0, 1);
  }

  function detect(rawText) {
    const text = (rawText || '').trim();
    const lang = detectLang(text);
    const charCount = text.length;
    const lowConfText = lang === 'zh' ? charCount < 60 : text.split(/\s+/).length < 40;

    const sentences = splitSentences(text, lang);
    const lens = sentences.map(s => sentenceLen(s, lang));
    const totalUnits = lang === 'zh'
      ? (text.match(/[一-鿿]/g) || []).length
      : text.split(/\s+/).filter(Boolean).length;

    const lower = text.toLowerCase();
    const clicheHits = countHits(lower, lang === 'zh' ? CLICHES_ZH : CLICHES_EN);
    const connHits = countHits(lower, lang === 'zh' ? CONNECTORS_ZH : CONNECTORS_EN);

    const clicheCount = clicheHits.reduce((a, h) => a + h.c, 0);
    const connCount = connHits.reduce((a, h) => a + h.c, 0);

    // 归一密度（每百单位）
    const per100 = totalUnits > 0 ? 100 / totalUnits : 0;
    const M1 = clamp(clicheCount * per100 / 4, 0, 1);      // 套话密度
    const burst = burstinessScore(lens);
    const M2 = burst.ai;                                   // 突发性缺失
    const M3 = clamp(connCount * per100 / 6, 0, 1);        // 连接词密度
    const M4 = structureScore(sentences, lens, lang);      // 结构整齐度

    const W = { M1: 0.40, M2: 0.25, M3: 0.20, M4: 0.15 };
    let score = (M1 * W.M1 + M2 * W.M2 + M3 * W.M3 + M4 * W.M4) * 100;
    score = Math.round(clamp(score, 0, 99));

    let verdict, level;
    if (score < 30) { verdict = '很可能为人工撰写'; level = 'ok'; }
    else if (score < 55) { verdict = '疑似部分 AI 参与/润色'; level = 'warn'; }
    else if (score < 75) { verdict = '较可能为 AI 生成'; level = 'warn'; }
    else { verdict = '很可能为 AI 生成'; level = 'danger'; }

    return {
      score, verdict, level, lang, charCount, lowConf: lowConfText,
      metrics: [
        { name: 'AI 套话密度', value: M1, detail: `命中 ${clicheCount} 处` },
        { name: '句长突发性缺失', value: M2, detail: burst.cv == null ? '样本过短' : 'CV=' + burst.cv.toFixed(2) },
        { name: '连接词密度', value: M3, detail: `命中 ${connCount} 处` },
        { name: '结构整齐度', value: M4, detail: `${sentences.length} 句` },
      ],
      cliches: clicheHits.sort((a, b) => b.c - a.c).slice(0, 20),
    };
  }

  // 调用本地 RoBERTa 检测服务（模型增强档）
  async function detectModel(text, endpoint) {
    const base = (endpoint || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const resp = await fetch(base + '/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) throw new Error('服务返回 ' + resp.status);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data; // { ai_prob, score, chunks, chunk_probs, model }
  }

  global.Detector = { detect, detectModel, detectLang };
})(window);
