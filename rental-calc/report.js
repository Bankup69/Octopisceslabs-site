// PDF deal report. Builds from the same sections the calculator shows, so the
// report always matches the screen. On the web the PDF downloads; in the apps
// it opens the share sheet (Mail, Messages, Files, AirDrop…).
(function () {
  'use strict';

  // EquityFoundry colors: midnight navy and champagne gold.
  const NAVY = [11, 22, 48];
  const GOLD = [196, 150, 72];
  const GREEN = NAVY; // table headers and totals
  let loading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  function loadLibs() {
    if (!loading) {
      loading = loadScript('vendor/jspdf.umd.min.js')
        .then(() => loadScript('vendor/jspdf.plugin.autotable.min.js'));
    }
    return loading;
  }

  // model: { title, subtitle, listingUrl, strategy, hero, tiles, tables, projection }
  function build(model) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = M;

    // Brand band
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 46, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 46, W, 2, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(242, 238, 228);
    doc.text('Equity', M, 29);
    doc.setTextColor(...GOLD);
    doc.text('Foundry', M + doc.getTextWidth('Equity'), 29);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('KNOW THE DEAL BEFORE YOU BUY.', W - M, 28, { align: 'right' });
    y = 48 + 28;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20);
    doc.text(model.title, M, y + 16);
    y += 34;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text([model.strategy, model.subtitle].filter(Boolean).join(' · '), M, y);
    y += 14;
    if (model.listingUrl) {
      doc.setTextColor(...NAVY);
      doc.textWithLink(model.listingUrl.length > 90 ? model.listingUrl.slice(0, 87) + '…' : model.listingUrl, M, y, { url: model.listingUrl });
      y += 14;
    }

    // Headline figure
    y += 8;
    doc.setDrawColor(220);
    doc.setFillColor(243, 238, 226);
    doc.roundedRect(M, y, W - 2 * M, 58, 6, 6, 'F');
    doc.setTextColor(90);
    doc.setFontSize(9);
    doc.text(model.hero.label.toUpperCase(), M + 14, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...(model.hero.negative ? [179, 38, 30] : GREEN));
    doc.text(model.hero.value, M + 14, y + 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(model.hero.sub || '', W - M - 14, y + 44, { align: 'right' });
    y += 74;

    // Key metrics, three per row
    const colW = (W - 2 * M) / 3;
    model.tiles.forEach((t, k) => {
      const x = M + (k % 3) * colW;
      const ty = y + Math.floor(k / 3) * 40;
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(t.label, x, ty);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20);
      doc.text(t.value, x, ty + 16);
      doc.setFont('helvetica', 'normal');
    });
    y += Math.ceil(model.tiles.length / 3) * 40 + 6;

    const pageH = doc.internal.pageSize.getHeight();
    const table = (title, head, body, opts) => {
      // Don't leave a table heading stranded at the bottom of a page.
      if (y > pageH - 110) { doc.addPage(); y = M; }
      doc.autoTable(Object.assign({
        startY: y,
        head: [head],
        body,
        theme: 'plain',
        margin: { left: M, right: M },
        styles: { fontSize: 9, cellPadding: 4, textColor: 30 },
        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 'auto' } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'right';
          if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right';
          const cls = d.section === 'body' && body[d.row.index]._cls;
          if (cls === 'subtotal' || cls === 'total') d.cell.styles.fontStyle = 'bold';
          if (cls === 'total') d.cell.styles.textColor = GREEN;
        },
        willDrawCell: (d) => {
          if (d.section === 'body') {
            doc.setDrawColor(230);
            doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
          }
        },
      }, opts));
      y = doc.lastAutoTable.finalY + 18;
    };

    model.tables.forEach((t) => {
      const body = t.rows.map(([label, value, cls]) => Object.assign([label, value], { _cls: cls }));
      table(t.title, [t.title, ''], body, { pageBreak: 'auto' });
    });

    if (model.projection) {
      const p = model.projection;
      table('Projection', p.head, p.body.map((r) => Object.assign(r.slice(), { _cls: '' })), { styles: { fontSize: 8, cellPadding: 3, textColor: 30 } });
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(p.summary, M, y - 6);
      y += 8;
    }

    // Footer on every page
    const pages = doc.getNumberOfPages();
    for (let n = 1; n <= pages; n++) {
      doc.setPage(n);
      doc.setFontSize(8);
      doc.setTextColor(140);
      const h = doc.internal.pageSize.getHeight();
      doc.text('Estimates based on the assumptions entered. Not financial advice. Made with EquityFoundry by OctoPisces Labs.', M, h - 20);
      doc.text(`${n} / ${pages}`, W - M, h - 20, { align: 'right' });
    }
    return doc;
  }

  function fileName(title) {
    return (title || 'Rental analysis').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + '.pdf';
  }

  async function exportReport(model) {
    await loadLibs();
    const doc = build(model);
    const name = fileName(model.title);
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
      const Filesystem = Cap.registerPlugin('Filesystem');
      const Share = Cap.registerPlugin('Share');
      const data = doc.output('datauristring').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
      await Share.share({ title: model.title, files: [uri], dialogTitle: 'Share report' });
    } else {
      doc.save(name);
    }
  }

  window.Report = { exportReport };
})();
