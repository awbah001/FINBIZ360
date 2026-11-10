// Dependency-free printable companion for the editable project walkthrough.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = new URL(
  "../docs/FINBIZ_360_EXPLANATION_AND_DEMONSTRATION_GUIDE.md",
  import.meta.url,
);
const output = new URL(
  "../docs/FINBIZ_360_EXPLANATION_AND_DEMONSTRATION_GUIDE.html",
  import.meta.url,
);
const markdown = readFileSync(source, "utf8");
const lines = markdown.replace(/\r\n/g, "\n").split("\n");
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function inline(text) {
  const pieces = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return pieces
    .map((s) => {
      if (s.startsWith("`") && s.endsWith("`"))
        return `<code>${escape(s.slice(1, -1))}</code>`;
      if (s.startsWith("**") && s.endsWith("**"))
        return `<strong>${escape(s.slice(2, -2))}</strong>`;
      const link = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        if (/^(?:javascript|data|vbscript):/i.test(link[2]))
          throw new Error("Unsafe link");
        return `<a href="${escape(link[2])}">${escape(link[1])}</a>`;
      }
      return escape(s);
    })
    .join("");
}
const toc = [],
  ids = new Set(),
  fragments = [];
const isTableDivider = (s) => /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(s);
const cells = (s) =>
  s
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((x) => x.trim());
for (let i = 0; i < lines.length;) {
  const line = lines[i];
  if (!line.trim()) {
    i++;
    continue;
  }
  if (line.startsWith("```")) {
    const code = [];
    for (i++; i < lines.length && !lines[i].startsWith("```"); i++)
      code.push(lines[i]);
    fragments.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
    i++;
    continue;
  }
  const heading = line.match(/^(#{1,3}) (.+)$/);
  if (heading) {
    const level = heading[1].length,
      label = heading[2];
    let id = label
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    while (ids.has(id)) id += "-section";
    ids.add(id);
    fragments.push(`<h${level} id="${id}">${inline(label)}</h${level}>`);
    if (level === 2) toc.push({ id, label });
    i++;
    continue;
  }
  if (line.startsWith("|") && isTableDivider(lines[i + 1] || "")) {
    const headers = cells(line),
      rows = [];
    i += 2;
    while (i < lines.length && lines[i].startsWith("|"))
      rows.push(cells(lines[i++]));
    if (rows.some((r) => r.length !== headers.length))
      throw new Error("Inconsistent table columns");
    fragments.push(
      `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${inline(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
    );
    continue;
  }
  if (/^>/.test(line)) {
    const paragraphs = [],
      current = [];
    while (i < lines.length && /^>/.test(lines[i])) {
      const text = lines[i++].replace(/^>\s?/, "");
      if (!text && current.length) {
        paragraphs.push(current.splice(0).join(" "));
      } else if (text) current.push(text);
    }
    if (current.length) paragraphs.push(current.join(" "));
    fragments.push(
      `<blockquote>${paragraphs.map((p) => `<p>${inline(p)}</p>`).join("")}</blockquote>`,
    );
    continue;
  }
  const list = line.match(/^(\d+)\. |^- /);
  if (list) {
    const ordered = /^\d+\./.test(line),
      items = [];
    const pattern = ordered ? /^\d+\. / : /^- /;
    while (i < lines.length && pattern.test(lines[i]))
      items.push(lines[i++].replace(pattern, ""));
    const tag = ordered ? "ol" : "ul",
      start = ordered ? ` start="${Number(list[1])}"` : "";
    fragments.push(
      `<${tag}${start}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`,
    );
    continue;
  }
  const paragraph = [line];
  i++;
  while (
    i < lines.length &&
    lines[i].trim() &&
    !/^(?:#{1,3} |```|\||>|- |\d+\. )/.test(lines[i])
  )
    paragraph.push(lines[i++]);
  fragments.push(`<p>${inline(paragraph.join(" "))}</p>`);
}
const title = "FinBiz 360 Project Explanation and Demonstration Guide";
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{color-scheme:light;font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#17212d;background:#eef2f5;font-size:16px;line-height:1.65}
*{box-sizing:border-box}body{margin:0}.toolbar{padding:14px max(20px,calc((100vw - 1100px)/2));display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:#fff;border-bottom:1px solid #d9d9d9}
.toolbar button{font:inherit;padding:8px 16px;border:1px solid #1d3c55;border-radius:6px;background:#1d3c55;color:#fff;cursor:pointer}.toolbar a{color:#1d3c55}.layout{max-width:1280px;margin:28px auto;display:grid;grid-template-columns:245px minmax(0,1fr);gap:28px;padding:0 24px}
nav{align-self:start;position:sticky;top:20px;max-height:calc(100vh - 40px);overflow:auto;font-size:13px}nav strong{display:block;color:#000;margin-bottom:8px}nav a{display:block;text-decoration:none;color:#344f66;padding:6px 0;border-bottom:1px solid #dfe5ea}nav a:hover{text-decoration:underline}
main{min-width:0;background:#fff;padding:48px 52px;box-shadow:0 4px 28px #20324612;border-radius:8px}h1,h2,h3{color:#000;line-height:1.25;scroll-margin-top:24px}h1{font-size:32px;max-width:650px;margin:0 0 22px;font-weight:700}h2{font-size:24px;margin:48px 0 16px}h3{font-size:18px;margin:26px 0 10px}p{margin:0 0 14px}strong{font-weight:700}a{color:#214f75}li{margin-bottom:8px}ol,ul{padding-left:25px;margin:12px 0 22px}code{font-family:Consolas,"Courier New",monospace;font-size:.88em;overflow-wrap:anywhere;background:#f3f5f7;padding:1px 4px;border-radius:3px}pre{padding:18px;background:#f3f5f7;border:1px solid #d9d9d9;overflow:auto;font-size:13px;line-height:1.5}pre code{padding:0;white-space:pre;overflow-wrap:normal}blockquote{margin:20px 0;padding:18px 22px;background:#f3f6f8;border-left:3px solid #a5b5c4}blockquote p:last-child{margin-bottom:0}.table-wrap{overflow:auto;margin:20px 0 26px}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.5}th,td{border:1px solid #d9d9d9;padding:11px 13px;vertical-align:middle;text-align:left}th{background:#dfe9f1;color:#000;font-weight:700}tbody tr:nth-child(even){background:#f7f9fb}td:first-child{width:29%}footer{font-size:12px;margin-top:38px;color:#526271}.downloads{padding:16px;background:#f3f6f8;border:1px solid #d9d9d9;margin:24px 0}
@media(max-width:900px){.layout{display:block;padding:0 14px}nav{position:static;max-height:none;margin-bottom:24px}main{padding:28px 22px}h1{font-size:28px}.table-wrap{max-width:100%}table{min-width:460px}}
@page{size:A4;margin:18mm 17mm 18mm}
@media print{html{background:#fff;font-size:10.5pt;line-height:1.48}.toolbar,nav,.downloads{display:none}.layout{display:block;margin:0;padding:0;max-width:none}main{padding:0;box-shadow:none;border-radius:0}h1{font-size:25pt;max-width:none}h2{font-size:17pt;margin-top:24pt}h3{font-size:12.5pt;margin-top:16pt}h1,h2,h3{break-after:avoid}p,li{orphans:3;widows:3}table{font-size:9pt;min-width:0}th,td{padding:7pt 8pt}thead{display:table-header-group}tr{break-inside:avoid}.table-wrap{overflow:visible;margin:12pt 0 16pt}blockquote,pre{break-inside:avoid}pre{font-size:8.5pt;white-space:pre-wrap}pre code{white-space:pre-wrap}a{color:#17212d;text-decoration:none}code{font-size:.9em}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<header class="toolbar"><button type="button" onclick="window.print()">Print or save as PDF</button><a href="FINBIZ_360_EXPLANATION_AND_DEMONSTRATION_GUIDE.md">Editable text version</a><span>Prepared 8 November 2026</span></header>
<div class="layout"><nav aria-label="Document contents"><strong>Contents</strong>${toc.map((x) => `<a href="#${x.id}">${escape(x.label)}</a>`).join("")}</nav>
<main>${fragments.join("\n")}<div class="downloads"><strong>Demonstration files</strong><p><a href="PRESENTATION_BANK_STATEMENT.csv">Valid sample statement</a> · <a href="PRESENTATION_INVALID_STATEMENT.csv">Invalid sample for preview validation</a></p></div><footer>FinBiz 360 project explanation and demonstration guide · Prepared 8 November 2026 · Passwords intentionally excluded</footer></main></div></body></html>`;
writeFileSync(output, html, "utf8");
console.log(
  JSON.stringify({
    output: fileURLToPath(output),
    sections: toc.length,
    words: markdown.split(/\s+/).length,
    tables: (html.match(/<table>/g) || []).length,
  }),
);
