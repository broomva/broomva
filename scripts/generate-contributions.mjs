#!/usr/bin/env node
/**
 * Fetches yearly GitHub contribution data via GraphQL and generates SVG charts.
 * Outputs: contributions-light.svg, contributions-dark.svg
 */

const TOKEN = process.env.GH_TOKEN;
const USERNAME = "broomva";
const JOINED_YEAR = 2018;
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();

const THEMES = {
  light: {
    bg: "white",
    title: "#111827",
    grid: "#e5e7eb",
    label: "#6b7280",
    dotStroke: "white",
    commitLine: "#2563eb",
    commitArea: "rgba(37,99,235,0.12)",
    totalLine: "#8b5cf6",
    totalArea: "rgba(139,92,246,0.1)",
    prLine: "#f59e0b",
  },
  dark: {
    bg: "#0d1117",
    title: "#e6edf3",
    grid: "#21262d",
    label: "#8b949e",
    dotStroke: "#0d1117",
    commitLine: "#58a6ff",
    commitArea: "rgba(88,166,255,0.15)",
    totalLine: "#a78bfa",
    totalArea: "rgba(167,139,250,0.12)",
    prLine: "#f59e0b",
  },
};

async function fetchContributions(from, to) {
  const query = `query {
    user(login: "${USERNAME}") {
      contributionsCollection(from: "${from}", to: "${to}") {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        totalRepositoryContributions
        restrictedContributionsCount
      }
    }
  }`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection;
}

async function getAllYears() {
  const years = [];
  for (let y = JOINED_YEAR; y <= CURRENT_YEAR; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === CURRENT_YEAR
      ? NOW.toISOString()
      : `${y + 1}-01-01T00:00:00Z`;

    const c = await fetchContributions(from, to);
    const total = c.totalCommitContributions + c.restrictedContributionsCount;
    years.push({
      year: y,
      commits: total,
      prs: c.totalPullRequestContributions,
      reviews: c.totalPullRequestReviewContributions,
      issues: c.totalIssueContributions,
      repos: c.totalRepositoryContributions,
      total: total + c.totalPullRequestContributions + c.totalIssueContributions,
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  return years;
}

function generateSVG(years, theme) {
  const t = THEMES[theme];
  const W = 900, H = 400;
  const pad = { top: 50, right: 30, bottom: 60, left: 65 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxTotal = Math.max(...years.map((y) => y.total));
  const yMax = Math.ceil(maxTotal / 500) * 500 || 500;

  const xScale = (i) => pad.left + (i / (years.length - 1)) * plotW;
  const yScale = (v) => pad.top + plotH - (v / yMax) * plotH;

  const gridLines = [];
  const yLabels = [];
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round((yMax / gridSteps) * i);
    const y = yScale(val);
    gridLines.push(`<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="${t.grid}" stroke-width="1"/>`);
    yLabels.push(`<text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif">${val.toLocaleString()}</text>`);
  }

  const totalPoints = years.map((y, i) => `${xScale(i)},${yScale(y.total)}`).join(" ");
  const totalAreaPts = `${xScale(0)},${yScale(0)} ${totalPoints} ${xScale(years.length - 1)},${yScale(0)}`;

  const commitPoints = years.map((y, i) => `${xScale(i)},${yScale(y.commits)}`).join(" ");
  const commitAreaPts = `${xScale(0)},${yScale(0)} ${commitPoints} ${xScale(years.length - 1)},${yScale(0)}`;

  const prPoints = years.map((y, i) => `${xScale(i)},${yScale(y.prs)}`).join(" ");

  const xLabels = years.map((y, i) =>
    `<text x="${xScale(i)}" y="${H - pad.bottom + 25}" text-anchor="middle" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif">${y.year}</text>`
  );

  const commitDots = years.map((y, i) =>
    `<circle cx="${xScale(i)}" cy="${yScale(y.commits)}" r="4" fill="${t.commitLine}" stroke="${t.dotStroke}" stroke-width="2"/>
     <text x="${xScale(i)}" y="${yScale(y.commits) - 12}" text-anchor="middle" fill="${t.commitLine}" font-size="11" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${y.commits.toLocaleString()}</text>`
  );

  const totalDots = years.map((y, i) =>
    `<circle cx="${xScale(i)}" cy="${yScale(y.total)}" r="4" fill="${t.totalLine}" stroke="${t.dotStroke}" stroke-width="2"/>
     <text x="${xScale(i)}" y="${yScale(y.total) - 12}" text-anchor="middle" fill="${t.totalLine}" font-size="11" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${y.total.toLocaleString()}</text>`
  );

  const totalAllTime = years.reduce((s, y) => s + y.total, 0);
  const totalCommitsAllTime = years.reduce((s, y) => s + y.commits, 0);
  const totalPRs = years.reduce((s, y) => s + y.prs, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.bg}" rx="12"/>

  <text x="${W / 2}" y="28" text-anchor="middle" fill="${t.title}" font-size="16" font-weight="700" font-family="system-ui, -apple-system, sans-serif">
    Contributions Since ${JOINED_YEAR} — ${totalAllTime.toLocaleString()} total · ${totalCommitsAllTime.toLocaleString()} commits · ${totalPRs.toLocaleString()} PRs
  </text>

  ${gridLines.join("\n  ")}
  ${yLabels.join("\n  ")}

  <polygon points="${totalAreaPts}" fill="${t.totalArea}"/>
  <polyline points="${totalPoints}" fill="none" stroke="${t.totalLine}" stroke-width="2.5" stroke-linejoin="round"/>

  <polygon points="${commitAreaPts}" fill="${t.commitArea}"/>
  <polyline points="${commitPoints}" fill="none" stroke="${t.commitLine}" stroke-width="2.5" stroke-linejoin="round"/>

  <polyline points="${prPoints}" fill="none" stroke="${t.prLine}" stroke-width="2" stroke-dasharray="6,3" stroke-linejoin="round"/>

  ${totalDots.join("\n  ")}
  ${commitDots.join("\n  ")}

  ${xLabels.join("\n  ")}

  <text x="18" y="${pad.top + plotH / 2}" text-anchor="middle" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif" transform="rotate(-90, 18, ${pad.top + plotH / 2})">Contributions</text>

  <rect x="${pad.left}" y="${H - 22}" width="12" height="12" rx="2" fill="${t.totalLine}"/>
  <text x="${pad.left + 17}" y="${H - 12}" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif">Total</text>
  <rect x="${pad.left + 70}" y="${H - 22}" width="12" height="12" rx="2" fill="${t.commitLine}"/>
  <text x="${pad.left + 87}" y="${H - 12}" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif">Commits</text>
  <line x1="${pad.left + 150}" y1="${H - 16}" x2="${pad.left + 170}" y2="${H - 16}" stroke="${t.prLine}" stroke-width="2" stroke-dasharray="6,3"/>
  <text x="${pad.left + 175}" y="${H - 12}" fill="${t.label}" font-size="12" font-family="system-ui, -apple-system, sans-serif">PRs</text>
</svg>`;
}

async function main() {
  console.log("Fetching contribution data...");
  const years = await getAllYears();
  console.log("Year data:", years.map((y) => `${y.year}: ${y.commits} commits, ${y.prs} PRs, ${y.total} total`).join("\n"));

  const fs = await import("fs");

  for (const theme of ["light", "dark"]) {
    const svg = generateSVG(years, theme);
    fs.writeFileSync(`contributions-${theme}.svg`, svg);
    console.log(`Generated contributions-${theme}.svg`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
