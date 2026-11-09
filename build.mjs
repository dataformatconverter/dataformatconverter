// Renders every page to dist/, using the real converters to generate the worked examples.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { bySlug, pageName, PAGES } from "./src/pages.js";
import { LOADERS } from "./src/registry.js";
import { INDEXNOW_KEY, SITE } from "./src/site.js";

const NAME = "Data Format Converter";
const OWNER = "Aleksandr Evtushenko";
const CONTACT = "contact@dataformatconverter.com";
const MAIL = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;
const DIST = new URL("./dist/", import.meta.url);
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const LOGO = `<rect width="32" height="32" rx="7" fill="#046b5c"/><path d="M9 12h12l-4-4M23 20H11l4 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
// Material icons, 24dp filled set.
const ICONS = {
  copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  folder: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
  swap: "M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
  expand: "M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z",
  file: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
};

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

function layout({ path, title, description, head = "", main }) {
  const url = `${SITE}${path}`;
  const links = PAGES.map((p) => `<li><a href="/${p.slug}">${esc(pageName(p))}</a></li>`).join("");
  const menu = PAGES.map((p) => {
    const current = path === `/${p.slug}`;
    return `<li><a href="/${p.slug}"${current ? ' class="current" aria-current="page"' : ""}>${esc(pageName(p))}</a></li>`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/roboto.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/styles.css">
${head}
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/"><svg viewBox="0 0 32 32" aria-hidden="true">${LOGO}</svg>${NAME}</a><nav><details class="menu"><summary class="btn">Tools${icon("expand")}</summary><ul class="menu-list">${menu}<li class="divider"><a href="/about">How it works</a></li></ul></details><a class="btn about-link" href="/about">How it works</a></nav></div></header>
<main class="wrap">
${main}
</main>
<footer><div class="wrap"><ul>${links}<li><a href="/about">How it works</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="/licenses.txt">Licences</a></li></ul>Files are converted on your device and are never uploaded.</div></footer>
<script type="module" src="/assets/app.js"></script>
</body>
</html>
`;
}

function field(option) {
  if (option.type === "checkbox") {
    return `<label class="switch"><input type="checkbox" role="switch" name="${option.name}"${option.checked ? " checked" : ""}><span>${esc(option.label)}</span></label>`;
  }
  if (option.type === "text") {
    return `<label class="field"><span>${esc(option.label)}</span><input type="text" name="${option.name}" value="${esc(option.value)}"${option.placeholder ? ` placeholder="${esc(option.placeholder)}"` : ""} spellcheck="false"></label>`;
  }
  const choices = option.options
    .map(([value, label]) => `<option value="${esc(value)}"${value === option.value ? " selected" : ""}>${esc(label)}</option>`)
    .join("");
  return `<label class="field"><span>${esc(option.label)}</span><select name="${option.name}">${choices}</select></label>`;
}

function inputPane(page, index, label, sample) {
  const id = `input${index}`;
  const sampleButton = index === 0 ? '<button type="button" id="sample" class="btn tonal">Try a sample</button>' : "";
  return `<div class="pane">
<div class="pane-head"><label for="${id}">${esc(label)}</label><label class="file btn outlined">${icon("folder")}Open file<input type="file" data-file="${index}" accept="${esc(page.accept)}"></label></div>
<div class="box"><textarea id="${id}" data-input data-sample="${esc(sample)}" spellcheck="false" autocomplete="off" placeholder=" "></textarea><div class="empty">${icon("file")}<p>Paste text, or drop a file here</p>${sampleButton}</div></div>
</div>`;
}

function defaults(page) {
  const values = {};
  for (const o of page.options) values[o.name] = o.type === "checkbox" ? o.checked : o.value;
  return values;
}

async function renderTool(page) {
  const run = await LOADERS[page.slug]();
  const inputsForExample = page.two ? [page.sample, page.sample2] : [page.sample];
  const example = run(...inputsForExample, defaults(page)).output.replace(/^\uFEFF/, "");
  const name = pageName(page);
  const outputLabel = page.outputLabel ?? page.to;
  const panes = page.two
    ? `${inputPane(page, 0, "First JSON (original)", page.sample)}${inputPane(page, 1, "Second JSON", page.sample2)}`
    : inputPane(page, 0, page.from, page.sample);
  const exampleIn = page.two
    ? `<div><h3>First</h3><pre><code>${esc(page.sample.trim())}</code></pre><h3>Second</h3><pre><code>${esc(page.sample2.trim())}</code></pre></div>`
    : `<div><h3>${esc(page.from)} input</h3><pre><code>${esc(page.sample.trim())}</code></pre></div>`;
  const swap = page.swap ? `<a class="chip" href="/${page.swap}">${icon("swap")}Swap to ${esc(pageName(bySlug[page.swap]))}</a>` : "";
  const related = page.related
    .map((slug) => `<li><a href="/${slug}"><strong>${esc(pageName(bySlug[slug]))}</strong><span>${esc(bySlug[slug].lead.split(".")[0])}.</span></a></li>`)
    .join("");

  const main = `<h1>${esc(page.h1 ?? `${name} Converter`)}</h1>
<p class="lead">${esc(page.lead)}</p>
${swap}
<section class="tool" data-tool="${page.slug}" data-ext="${page.outExt}" data-mime="${esc(page.mime)}" aria-label="${esc(name)} tool">
<div class="panes${page.two ? " three" : ""}">
${panes}
<div class="pane out">
<div class="pane-head"><span class="label">${esc(outputLabel)}</span><div class="actions"><button type="button" id="copy" class="btn tonal">${icon("copy")}Copy</button><button type="button" id="download" class="btn filled">${icon("download")}Download</button></div></div>
<div class="box"><textarea id="output" readonly spellcheck="false" aria-label="${esc(outputLabel)}" placeholder="Result appears here"></textarea></div>
<p class="status" id="status" role="status"></p>
<ul class="notes" id="notes"></ul>
</div>
</div>
<div class="controls">
<form id="options">${page.options.map(field).join("")}</form>
<div class="actions"><button type="button" id="clear" class="btn">Clear</button><button type="button" id="convert" class="btn filled" hidden>${page.two ? "Compare" : "Convert"}</button></div>
</div>
<div class="snackbar" id="snackbar" role="status" hidden></div>
</section>

<h2>Example</h2>
<div class="example">
${exampleIn}
<div><h3>${esc(outputLabel)}</h3><pre><code>${esc(example.trim())}</code></pre></div>
</div>

<h2>How it handles tricky cases</h2>
<div class="prose">
${page.edge.map(([title, body]) => `<h3>${esc(title)}</h3><p>${esc(body)}</p>`).join("\n")}
</div>

<h2>Do it from code</h2>
<p>${esc(page.code[0])}:</p>
<pre><code>${esc(page.code[1])}</code></pre>

<h2>Questions</h2>
${page.faq.map(([q, a]) => `<details class="faq"><summary>${esc(q)}${icon("expand")}</summary><p>${esc(a)}</p></details>`).join("\n")}

<h2>Related tools</h2>
<ul class="cards">${related}</ul>`;

  const url = `${SITE}/${page.slug}`;
  const head = jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: `${name}${page.to ? " Converter" : ""}`,
        url,
        description: page.description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: NAME, item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  });
  return layout({ path: `/${page.slug}`, title: page.title, description: page.description, head, main });
}

function renderHome() {
  const cards = PAGES.map(
    (p) => `<li><a href="/${p.slug}"><strong>${esc(pageName(p))}</strong><span>${esc(p.description.split(". ")[1].replace(/,? and never upload.*$/, "."))}</span></a></li>`,
  ).join("");
  const description = "Free converters for JSON, CSV, XML, YAML and XLSX that run entirely in your browser. No uploads and no sign-up.";
  const head = jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: `${SITE}/`, description });
  const main = `<section class="hero"><h1>Convert data formats without uploading anything</h1>
<p class="lead">Free tools for JSON, CSV, XML, YAML and XLSX. Each one runs entirely in your browser, with no uploads and no sign-up.</p></section>
<ul class="cards">${cards}</ul>
<h2>Why in the browser?</h2>
<div class="prose"><p>Data files often hold customer records, config values or API responses. Most online converters send your file to a server to process it. These tools do the work on your own device instead, so the file doesn't go anywhere. <a href="/about">See how that works and how to check it</a>.</p></div>`;
  return layout({ path: "/", title: `${NAME}: JSON, CSV, XML, YAML and XLSX in Your Browser`, description, head, main });
}

function renderAbout() {
  const description = "How Data Format Converter processes your files on your own device, and how you can check that nothing is uploaded.";
  const main = `<h1>How it works</h1>
<p class="lead">Every conversion on this site happens on your device. There is no server-side processing.</p>
<div class="prose">
<h2>Your data stays in your browser</h2>
<p>When you paste text or open a file, the page's JavaScript reads it and converts it locally. The site is a set of static files, with no application server that could receive your data.</p>
<h2>How the site enforces it</h2>
<p>Each page is served with a Content Security Policy containing <code>connect-src 'none'</code>, which tells your browser to block the page from opening network connections to send data. The site also runs no advertising or third-party analytics scripts.</p>
<h2>How to check for yourself</h2>
<p>Open your browser's developer tools, switch to the Network tab, and run a conversion. You'll see no request carrying your data. You can also load a page, disconnect from the internet, and confirm that conversions still work once the page's code has loaded.</p>
<h2>What the host can see</h2>
<p>Like any website, the hosting provider receives standard request information when your browser loads a page, such as your IP address and the page requested. It doesn't receive what you paste or open in the tools.</p>
<h2>Limits</h2>
<p>Because the work happens on your device, very large files are limited by your browser's memory. Files over about 1 MB aren't shown in the text box and convert when you press Convert.</p>
<h2>Who runs this site</h2>
<p>${NAME} is free, has no ads and is run by ${OWNER}. For questions or bug reports, write to ${MAIL}.</p>
</div>`;
  return layout({ path: "/about", title: `How It Works | ${NAME}`, description, main });
}

function renderPrivacy() {
  const description = `What ${NAME} does with personal data: your files stay on your device, there are no cookies, and the host sees only standard connection data.`;
  const main = `<h1>Privacy</h1>
<p class="lead">Last updated November 2026. The files and text you convert stay on your device and are never sent to this site.</p>
<div class="prose">
<h2>Who is responsible</h2>
<p>${OWNER} runs this site and is the controller of the personal data described here. You can reach me at ${MAIL}.</p>
<h2>What you convert</h2>
<p>The tools run in your browser. What you paste or open isn't uploaded, stored or seen by me. <a href="/about">How it works</a> explains how to check this.</p>
<h2>No cookies, tracking or ads</h2>
<p>The site sets no cookies, saves nothing in your browser's storage, shows no ads and runs no analytics or other third-party scripts. Its code and fonts all load from this site.</p>
<h2>What the host receives</h2>
<p>The site is delivered by Cloudflare, Inc., which acts as a data processor on my behalf. As with any website, loading a page gives Cloudflare your IP address and technical request details, such as the page requested and your browser type. This data is used to deliver the site and protect it from abuse, which is a legitimate interest under Article 6(1)(f) of the GDPR. I only look at total traffic figures in Cloudflare's dashboard.</p>
<h2>How long it's kept and where</h2>
<p>Cloudflare keeps this data for as long as its own retention rules require, based on the purpose and on legal obligations. It doesn't publish a fixed period. It stores data mainly in the United States and the European Economic Area and may access it wherever it operates, using safeguards such as the EU-U.S. Data Privacy Framework and standard contractual clauses. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</p>
<h2>If you email me</h2>
<p>I use your address and message to reply, based on my legitimate interest in answering you. Email to this address is forwarded by Cloudflare to a Gmail inbox provided by Google. I keep messages only as long as needed to deal with them.</p>
<h2>Your rights</h2>
<p>Depending on where you live, you can ask for access to your personal data, and for it to be corrected, erased, restricted or transferred, and you can object to its use. Write to the address above to do so. You can also complain to your local data protection authority.</p>
<h2>Changes</h2>
<p>If this page changes, the date at the top changes too. If ads or analytics are ever added, this page will be updated first.</p>
</div>`;
  return layout({ path: "/privacy", title: `Privacy | ${NAME}`, description, main });
}

function renderTerms() {
  const description = `Terms for using ${NAME}: free tools, no accounts, and no warranty on converted output.`;
  const main = `<h1>Terms of use</h1>
<p class="lead">Last updated November 2026. By using this site, you agree to these terms.</p>
<div class="prose">
<h2>The service</h2>
<p>${NAME} is a free set of data conversion tools run by ${OWNER}. It needs no account. Tools may change or be withdrawn at any time.</p>
<h2>Your data</h2>
<p>You keep all rights to what you convert. It stays on your device, and you're responsible for having the right to use it.</p>
<h2>Check your results</h2>
<p>The tools are provided as is, without any warranty. Conversions can be wrong or incomplete, especially with unusual or very large files, so check the output before relying on it and keep a copy of your original.</p>
<h2>Liability</h2>
<p>To the extent the law allows, I'm not liable for any loss arising from your use of the site, including lost or incorrect data. Nothing here limits rights you have under mandatory law, such as consumer protection law, or liability that can't legally be excluded.</p>
<h2>Fair use</h2>
<p>Don't attack the site, interfere with its operation or use it to break the law.</p>
<h2>Open-source components</h2>
<p>The site includes open-source software and fonts, used under the <a href="/licenses.txt">licences listed here</a>.</p>
<h2>Changes and contact</h2>
<p>These terms may be updated, and the date at the top will change when they are. Questions can be sent to ${MAIL}.</p>
</div>`;
  return layout({ path: "/terms", title: `Terms of Use | ${NAME}`, description, main });
}

/** Bundling strips most licence text, so the notice of every package that ships is collected here. */
async function licenseFile(inputs) {
  const names = new Set(["@fontsource-variable/roboto"]);
  for (const input of Object.keys(inputs)) {
    const match = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (match) names.add(match[1]);
  }
  const sections = [];
  for (const name of [...names].sort()) {
    const dir = new URL(`./node_modules/${name}/`, import.meta.url);
    const pkg = JSON.parse(await readFile(new URL("package.json", dir), "utf8"));
    const file = (await readdir(dir)).find((f) => /^licen[cs]e/i.test(f));
    const text = file
      ? await readFile(new URL(file, dir), "utf8")
      : `Licensed under ${pkg.license}. The package includes no separate licence file.\nAuthor: ${pkg.author}\nSource: ${pkg.repository?.url}`;
    sections.push(`${name} ${pkg.version}\n\n${text.trim()}`);
  }
  const apache = await readFile(new URL("./static/apache-2.0.txt", import.meta.url), "utf8");
  sections.push(`Material Icons\nCopyright Google LLC. Licensed under the Apache License, Version 2.0.\n\n${apache.trim()}`);
  const rule = `\n\n${"=".repeat(72)}\n\n`;
  return `${NAME} uses the following open-source software and fonts.${rule}${sections.join(rule)}\n`;
}

function render404() {
  return layout({
    path: "/404",
    title: `Page not found | ${NAME}`,
    description: "This page doesn't exist.",
    head: '<meta name="robots" content="noindex">',
    main: `<h1>Page not found</h1><p class="lead">That page doesn't exist. <a href="/">See all the converters</a>.</p>`,
  });
}

await rm(DIST, { recursive: true, force: true });
await mkdir(new URL("assets/", DIST), { recursive: true });

const { metafile } = await build({
  entryPoints: ["src/app.js"],
  metafile: true,
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  target: "es2022",
  outdir: "dist/assets",
  chunkNames: "[name]-[hash]",
  logLevel: "warning",
});
await copyFile(new URL("./src/styles.css", import.meta.url), new URL("assets/styles.css", DIST));
await copyFile(new URL("./node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2", import.meta.url), new URL("assets/roboto.woff2", DIST));
await copyFile(new URL("./static/og.png", import.meta.url), new URL("og.png", DIST));

const write = (name, content) => writeFile(new URL(name, DIST), content);
const routes = [["/", "index.html", renderHome()]];
for (const page of PAGES) routes.push([`/${page.slug}`, `${page.slug}.html`, await renderTool(page)]);
routes.push(["/about", "about.html", renderAbout()], ["/privacy", "privacy.html", renderPrivacy()], ["/terms", "terms.html", renderTerms()]);
for (const [, file, html] of routes) await write(file, html);
await write("404.html", render404());

// A page keeps its date until its HTML changes, so search engines can trust the sitemap.
const stampsFile = new URL("./lastmod.json", import.meta.url);
const stamps = JSON.parse(await readFile(stampsFile, "utf8").catch(() => "{}"));
const today = new Date().toISOString().slice(0, 10);
for (const [route, , html] of routes) {
  const hash = createHash("sha256").update(html).digest("hex");
  if (stamps[route]?.hash !== hash) stamps[route] = { hash, date: today };
}
await writeFile(stampsFile, `${JSON.stringify(stamps, null, 2)}\n`);
const urls = routes.map(([route]) => route);
await write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${stamps[u].date}</lastmod></url>`).join("\n")}
</urlset>
`,
);
await write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
await write("licenses.txt", await licenseFile(metafile.inputs));
await write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
await write(
  "_headers",
  `/*\n  Content-Security-Policy: ${CSP}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`,
);
await write(
  "favicon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${LOGO}</svg>`,
);
console.log(`built ${urls.length + 1} pages`);
