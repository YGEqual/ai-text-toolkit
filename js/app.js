/* app.js — UI 总控 */
(function () {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ---------- Tabs ----------
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#panel-' + t.dataset.tab).classList.add('active');
  }));

  // ================= AI 率检测 =================
  const detectInput = $('#detect-input');
  const SAMPLE_DETECT = '在当今数字化飞速发展的时代，人工智能正扮演着越来越重要的角色。首先，它显著提升了生产效率；其次，它赋能各行各业实现智能化转型。综上所述，人工智能不仅改变了我们的工作方式，而且深刻影响着社会的方方面面，具有重要意义。';

  detectInput.addEventListener('input', () => {
    $('#detect-count').textContent = detectInput.value.length + ' 字';
  });
  $('#btn-detect-sample').onclick = () => { detectInput.value = SAMPLE_DETECT; detectInput.dispatchEvent(new Event('input')); };
  $('#btn-detect-clear').onclick = () => { detectInput.value = ''; detectInput.dispatchEvent(new Event('input')); $('#detect-result').innerHTML = '<p class="muted">检测结果将显示在这里。</p>'; };

  $('#btn-detect').onclick = () => {
    const text = detectInput.value.trim();
    if (!text) { $('#detect-result').innerHTML = '<p class="muted">请输入文案。</p>'; return; }
    const r = window.Detector.detect(text);
    renderDetect(r);
  };

  function renderDetect(r) {
    const colorVar = { ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)' }[r.level];
    let html = `
      <div class="gauge-wrap">
        <div class="gauge" style="--val:${r.score}; --col:${colorVar}">
          <span class="gauge-num">${r.score}<small>%</small></span>
        </div>
        <div class="verdict" style="color:${colorVar}">${r.verdict}</div>
        <div class="muted">语言：${r.lang === 'zh' ? '中文' : '英文'} · ${r.charCount} 字</div>
        ${r.lowConf ? '<div class="hint">⚠ 文本较短，结果置信度低，建议 ≥ 一段文字。</div>' : ''}
      </div>`;
    html += r.metrics.map(m => `
      <div class="metric">
        <div class="metric-top"><span>${m.name}</span><span class="muted">${m.detail}</span></div>
        <div class="bar"><i style="width:${Math.round(m.value * 100)}%"></i></div>
      </div>`).join('');
    if (r.cliches.length) {
      html += `<div class="cliche-box"><h4>命中的 AI 高频表达</h4>` +
        r.cliches.map(c => `<span class="tag">${esc(c.w)}${c.c > 1 ? ' ×' + c.c : ''}</span>`).join('') +
        `</div>`;
    }
    html += `<p class="hint">启发式概率估计，仅供参考，不作为绝对判定依据。</p>`;
    $('#detect-result').className = '';
    $('#detect-result').innerHTML = html;
  }

  // ================= 去 AI 化 =================
  const hzInput = $('#hz-input');
  const SAMPLE_HZ = SAMPLE_DETECT;
  hzInput.addEventListener('input', () => { $('#hz-count').textContent = hzInput.value.length + ' 字'; });
  $('#btn-hz-sample').onclick = () => { hzInput.value = SAMPLE_HZ; hzInput.dispatchEvent(new Event('input')); };
  $('#btn-hz-clear').onclick = () => { hzInput.value = ''; hzInput.dispatchEvent(new Event('input')); $('#hz-output').value = ''; $('#hz-report').innerHTML = ''; };

  $('#btn-humanize').onclick = () => {
    const text = hzInput.value.trim();
    if (!text) { $('#hz-report').textContent = '请输入文案。'; return; }
    const r = window.Humanizer.humanize(text, {
      removeCliche: $('#hz-removeCliche').checked,
      dash: $('#hz-dash').checked,
      burst: $('#hz-burst').checked,
      synonym: $('#hz-synonym').checked,
      strength: $('#hz-strength').value,
    });
    $('#hz-output').value = r.output;
    const total = r.changes.reduce((a, c) => a + c.n, 0);
    $('#hz-report').innerHTML = total
      ? `共调整 <b>${total}</b> 处：` + r.changes.map(c => `${c.label} <b>${c.n}</b>`).join('，')
      : '未检测到可调整的 AI 痕迹。';
  };
  $('#btn-hz-copy').onclick = async () => {
    const v = $('#hz-output').value;
    if (!v) return;
    try { await navigator.clipboard.writeText(v); $('#btn-hz-copy').textContent = '已复制'; setTimeout(() => $('#btn-hz-copy').textContent = '复制', 1200); }
    catch { $('#hz-output').select(); document.execCommand('copy'); }
  };

  // ================= PDF 加页码 =================
  let pdfBuffer = null, fontBuffer = null;
  const drop = $('#pdf-drop'), fileInput = $('#pdf-file');

  function loadPdf(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { setPdfStatus('请选择 PDF 文件', 'err'); return; }
    const reader = new FileReader();
    reader.onload = e => { pdfBuffer = e.target.result; $('#pdf-filename').textContent = file.name; setPdfStatus('已载入：' + file.name, 'ok'); };
    reader.readAsArrayBuffer(file);
  }
  fileInput.addEventListener('change', e => loadPdf(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => loadPdf(e.dataTransfer.files[0]));

  // 中文字体行显隐
  const fmtSel = $('#pdf-format'), fontRow = $('.zh-font-row');
  function syncFontRow() {
    const need = fmtSel.selectedOptions[0].dataset.needfont === '1';
    fontRow.hidden = !need;
  }
  fmtSel.addEventListener('change', syncFontRow); syncFontRow();
  $('#btn-pick-font').onclick = () => $('#pdf-font').click();
  $('#pdf-font').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { fontBuffer = ev.target.result; $('#pdf-fontname').textContent = f.name; };
    reader.readAsArrayBuffer(f);
  });

  function setPdfStatus(msg, cls) { const el = $('#pdf-status'); el.textContent = msg; el.className = 'status ' + (cls || ''); }

  $('#btn-pdf-run').onclick = async () => {
    if (!pdfBuffer) { setPdfStatus('请先选择 PDF 文件', 'err'); return; }
    const positions = [];
    if ($('#pos-bc').checked) positions.push('bc');
    if ($('#pos-br').checked) positions.push('br');
    if ($('#pos-bl').checked) positions.push('bl');
    if (!positions.length) { setPdfStatus('请至少选择一个页码位置', 'err'); return; }

    const fmt = fmtSel.value;
    const needFont = fmtSel.selectedOptions[0].dataset.needfont === '1';
    if (needFont && !fontBuffer) { setPdfStatus('该中文格式需先选择一个中文字体文件', 'err'); return; }

    setPdfStatus('正在处理…');
    try {
      const r = await window.PdfPager.addPageNumbers(pdfBuffer.slice(0), {
        positions, format: fmt, order: $('#pdf-order').value,
        start: $('#pdf-start').value, from: $('#pdf-from').value, to: $('#pdf-to').value,
        size: $('#pdf-size').value, margin: $('#pdf-margin').value, color: $('#pdf-color').value,
        fontBytes: needFont ? fontBuffer : null,
      });
      const blob = new Blob([r.bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'paged.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setPdfStatus(`完成：共 ${r.total} 页，已标注 ${r.labeled} 页，已下载 paged.pdf`, 'ok');
    } catch (err) {
      console.error(err);
      setPdfStatus('处理失败：' + err.message, 'err');
    }
  };

  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
})();
