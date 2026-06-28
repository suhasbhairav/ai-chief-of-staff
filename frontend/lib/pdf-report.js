import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = {
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  indigo: [79, 70, 229],
  cyan: [8, 145, 178],
  emerald: [5, 150, 105],
  amber: [217, 119, 6],
  light: [248, 250, 252],
};

const formatDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const sanitizeFilename = (value) =>
  String(value || "ai-chief-of-staff-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const addPageNumber = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text("TAI Chief", 40, height - 22);
    doc.text(`Page ${page} of ${pageCount}`, width - 40, height - 22, {
      align: "right",
    });
  }
};

const addSectionTitle = (doc, title, subtitle, y) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...BRAND.ink);
  doc.text(title, 40, y);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, 40, y + 16);
    return y + 30;
  }

  return y + 20;
};

const drawMetricCards = (doc, metrics, startY) => {
  const width = doc.internal.pageSize.getWidth();
  const cardGap = 10;
  const cardWidth = (width - 80 - cardGap * 3) / 4;
  const cardHeight = 58;

  metrics.slice(0, 4).forEach((metric, index) => {
    const x = 40 + index * (cardWidth + cardGap);
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(...BRAND.line);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 8, 8, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(String(metric.name || "Metric"), x + 10, startY + 18, {
      maxWidth: cardWidth - 20,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...BRAND.ink);
    doc.text(String(metric.value || "Missing"), x + 10, startY + 42, {
      maxWidth: cardWidth - 20,
    });
  });

  return startY + cardHeight + 26;
};

const drawCover = (doc, report) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setFillColor(8, 13, 31);
  doc.rect(0, 0, width, height, "F");

  doc.setFillColor(...BRAND.indigo);
  doc.circle(width - 72, 86, 58, "F");
  doc.setFillColor(...BRAND.cyan);
  doc.circle(width - 138, 150, 36, "F");
  doc.setFillColor(...BRAND.emerald);
  doc.circle(74, height - 92, 44, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(199, 210, 254);
  doc.text("TAI CHIEF", 40, 78);

  doc.setFontSize(34);
  doc.setTextColor(255, 255, 255);
  doc.text(report.title, 40, 130, { maxWidth: width - 100 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(203, 213, 225);
  doc.text(
    "Board-ready operating intelligence generated from department metrics, executive scorecards, and AI synthesis.",
    40,
    206,
    { maxWidth: width - 115, lineHeightFactor: 1.45 }
  );

  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(1.4);
  doc.line(40, 252, width - 40, 252);

  autoTable(doc, {
    startY: 282,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      textColor: [226, 232, 240],
      cellPadding: { top: 4, bottom: 4, left: 0, right: 8 },
    },
    body: [
      ["Prepared for", report.departmentName],
      ["Generated", formatDate(report.generatedAt)],
    ],
    columnStyles: {
      0: { textColor: [148, 163, 184], fontStyle: "bold", cellWidth: 90 },
      1: { textColor: [255, 255, 255] },
    },
  });
};

const drawInsightPage = (doc, report) => {
  doc.addPage();
  let y = addSectionTitle(
    doc,
    "Executive Intelligence Synthesis",
    "Latest OpenAI-generated recommendation text included from the dashboard state.",
    54
  );

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(40, y, 515, 250, 10, 10, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(report.insights || "No OpenAI synthesis has been generated yet.", 58, y + 26, {
    maxWidth: 480,
    lineHeightFactor: 1.35,
  });

  y += 290;
  y = addSectionTitle(doc, "KPI Snapshot", null, y);
  drawMetricCards(doc, report.metrics, y);
};

const drawChartSummary = (doc, chartPanels) => {
  doc.addPage();
  let y = addSectionTitle(
    doc,
    "Chart Scorecards",
    "Chart source data from the live dashboard calculations.",
    54
  );

  chartPanels.forEach((panel, index) => {
    if (index > 0 && y > 560) {
      doc.addPage();
      y = addSectionTitle(doc, "Chart Scorecards", null, 54);
    }

    const rows = (panel.data || []).map((point) => [
      point.period,
      ...panel.series.map((series) => point[series.key] ?? ""),
    ]);

    autoTable(doc, {
      startY: y,
      head: [[panel.title, ...panel.series.map((series) => series.name)]],
      body: rows.length ? rows : [["No data uploaded", ...panel.series.map(() => "")]],
      theme: "grid",
      headStyles: {
        fillColor: index % 2 ? BRAND.cyan : BRAND.indigo,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 5,
        textColor: BRAND.ink,
        lineColor: BRAND.line,
      },
      alternateRowStyles: { fillColor: BRAND.light },
      margin: { left: 40, right: 40 },
    });

    y = doc.lastAutoTable.finalY + 24;
  });
};

const drawDepartmentTables = (doc, report) => {
  const departments = report.isExecutive
    ? report.storedDepartmentRows
    : [report.departmentUpload].filter(Boolean);

  doc.addPage();
  let y = addSectionTitle(
    doc,
    report.isExecutive ? "Department Data Tables" : "Department Uploaded Data",
    "Tables are generated from Supabase JSONB snapshots.",
    54
  );

  departments.forEach((department, index) => {
    if (index > 0 || y > 620) {
      doc.addPage();
      y = addSectionTitle(doc, "Department Data Tables", null, 54);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND.ink);
    doc.text(department.departmentName, 40, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `${department.filename || "No file"} | ${department.recordCount || 0} rows | Updated ${formatDate(department.uploadedAt)}`,
      40,
      y + 14
    );

    const headers = (department.headers || []).slice(0, 8);
    const rows = (department.records || []).slice(0, report.isExecutive ? 8 : 24);

    autoTable(doc, {
      startY: y + 28,
      head: [headers.length ? headers : ["No columns"]],
      body: rows.length
        ? rows.map((row) => headers.map((header) => String(row[header] ?? "")))
        : [["No uploaded records"]],
      theme: "grid",
      headStyles: {
        fillColor: BRAND.ink,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 4,
        overflow: "linebreak",
        textColor: BRAND.ink,
        lineColor: BRAND.line,
      },
      alternateRowStyles: { fillColor: BRAND.light },
      margin: { left: 40, right: 40 },
    });

    y = doc.lastAutoTable.finalY + 28;
  });
};

const drawHistoricalImports = (doc, historicalImports = []) => {
  doc.addPage();
  const y = addSectionTitle(
    doc,
    "Historical Trend Imports",
    "Immutable upload history stored in Supabase for multi-period analysis.",
    54
  );

  autoTable(doc, {
    startY: y,
    head: [["Department", "File", "Rows", "Period", "Imported"]],
    body: historicalImports.length
      ? historicalImports.slice(0, 40).map((item) => [
          item.departmentName,
          item.filename || "No file",
          item.recordCount,
          [item.periodStart, item.periodEnd].filter(Boolean).join(" to ") ||
            "Not detected",
          formatDate(item.importedAt),
        ])
      : [["No historical imports yet", "", "", "", ""]],
    theme: "grid",
    headStyles: {
      fillColor: BRAND.amber,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 5,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
    },
    alternateRowStyles: { fillColor: BRAND.light },
    margin: { left: 40, right: 40 },
  });
};

const drawMethodology = (doc, report) => {
  doc.addPage();
  let y = addSectionTitle(
    doc,
    "Report Methodology",
    "How this report was assembled from the application state.",
    54
  );

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Area", "Method"]],
    body: [
      ["Storage", "Department CSV uploads are stored as flexible Supabase JSONB snapshots."],
      ["Metrics", "KPI cards are calculated from the live department records and executive rollup logic."],
      ["Charts", "Chart tables reflect the same calculated data powering the dashboard visualizations."],
      ["AI Synthesis", "OpenAI recommendations are included only after the user explicitly fetches suggestions."],
      ["Auth", "No Supabase Auth is required for this database-only MVP."],
    ],
    headStyles: {
      fillColor: BRAND.emerald,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 7,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 110 },
    },
    margin: { left: 40, right: 40 },
  });

  y = doc.lastAutoTable.finalY + 38;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.muted);
  doc.text("Generated by TAI Chief.", 40, y);
};

export const generateDashboardPdfReport = (report) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  drawCover(doc, report);
  drawInsightPage(doc, report);
  drawChartSummary(doc, report.chartPanels || []);
  drawDepartmentTables(doc, report);
  drawHistoricalImports(doc, report.historicalImports || []);
  drawMethodology(doc, report);
  addPageNumber(doc);

  doc.save(`${sanitizeFilename(report.title)}-${Date.now()}.pdf`);
};

export const generateBoardMemoPdf = (memo) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  drawCover(doc, {
    title: memo.title || "Board Memo",
    departmentName: memo.departmentName || "Executive / Office of the CEO",
    generatedAt: memo.generatedAt,
  });

  doc.addPage();
  let y = addSectionTitle(
    doc,
    "Board Memo",
    "Concise board-facing operating narrative generated from live dashboard data.",
    54
  );

  const sections = [
    ["Executive Summary", memo.executiveSummary],
    ["CEO Recommendation", memo.recommendation],
    ["Key Risks", memo.risks],
    ["Next Operating Actions", memo.actions],
  ];

  sections.forEach(([title, body]) => {
    if (y > 690) {
      doc.addPage();
      y = 54;
    }

    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(...BRAND.line);
    doc.roundedRect(40, y, width - 80, 92, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, 56, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(body || "No content available.", 56, y + 42, {
      maxWidth: width - 112,
      lineHeightFactor: 1.3,
    });
    y += 108;
  });

  y = addSectionTitle(doc, "Board KPI Snapshot", null, y + 8);
  drawMetricCards(doc, memo.metrics || [], y);

  drawChartSummary(doc, memo.chartPanels || []);
  drawHistoricalImports(doc, memo.historicalImports || []);
  drawMethodology(doc, {
    isExecutive: true,
  });
  addPageNumber(doc);

  doc.save(`${sanitizeFilename(memo.title || "board-memo")}-${Date.now()}.pdf`);
};
