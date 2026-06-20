/* pdf-pager.js — 给 PDF 添加页码（纯本地，基于开源 pdf-lib）
 * 支持：多位置（下方居中/右下/左下）、格式、正/倒序、起始页码、标注范围、样式、中文字体。
 */
(function (global) {
  'use strict';

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#333333');
    if (!m) return { r: 0.2, g: 0.2, b: 0.2 };
    return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
  }

  function formatLabel(fmt, n, count) {
    switch (fmt) {
      case 'slash': return `${n} / ${count}`;
      case 'dash': return `- ${n} -`;
      case 'en': return `Page ${n} of ${count}`;
      case 'zh': return `第 ${n} 页`;
      case 'zhfull': return `第 ${n} 页 / 共 ${count} 页`;
      default: return `${n}`;
    }
  }

  async function addPageNumbers(arrayBuffer, opts) {
    const { PDFDocument, StandardFonts, rgb } = global.PDFLib;
    const pdf = await PDFDocument.load(arrayBuffer);

    let font;
    if (opts.fontBytes) {
      pdf.registerFontkit(global.fontkit);
      font = await pdf.embedFont(opts.fontBytes, { subset: true });
    } else {
      font = await pdf.embedFont(StandardFonts.Helvetica);
    }

    const pages = pdf.getPages();
    const total = pages.length;
    const from = Math.min(Math.max(parseInt(opts.from, 10) || 1, 1), total);
    let to = parseInt(opts.to, 10) || 0;
    to = to > 0 ? Math.min(to, total) : total;
    if (to < from) throw new Error('结束页不能小于起始页');

    const count = to - from + 1;
    const start = parseInt(opts.start, 10);
    const startNum = isNaN(start) ? 1 : start;
    const size = parseInt(opts.size, 10) || 11;
    const margin = parseInt(opts.margin, 10);
    const m = isNaN(margin) ? 24 : margin;
    const color = hexToRgb(opts.color);
    const positions = (opts.positions && opts.positions.length) ? opts.positions : ['bc'];

    for (let idx = from - 1; idx <= to - 1; idx++) {
      const seq = idx - (from - 1);                       // 0..count-1
      const n = opts.order === 'desc' ? startNum + (count - 1 - seq) : startNum + seq;
      const label = formatLabel(opts.format, n, count);
      const page = pages[idx];
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(label, size);

      for (const pos of positions) {
        let x;
        if (pos === 'bc') x = (width - textWidth) / 2;
        else if (pos === 'br') x = width - m - textWidth;
        else x = m; // bl
        page.drawText(label, { x, y: m, size, font, color: rgb(color.r, color.g, color.b) });
      }
    }

    const bytes = await pdf.save();
    return { bytes, total, labeled: count };
  }

  global.PdfPager = { addPageNumbers };
})(window);
