// Bundles the extension from the site's converters and collects the notices of everything bundled.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const here = (path) => new URL(path, import.meta.url);

await rm(here("./dist/"), { recursive: true, force: true });
await mkdir(here("./dist/"));
const { metafile } = await build({
  absWorkingDir: here(".").pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  entryPoints: ["src/extension.js"],
  outfile: "dist/extension.cjs",
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  logLevel: "warning",
  metafile: true,
});

const names = new Set();
for (const input of Object.keys(metafile.inputs)) {
  const match = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (match) names.add(match[1]);
}
const sections = [];
for (const name of [...names].sort()) {
  const dir = here(`../../node_modules/${name}/`);
  const pkg = JSON.parse(await readFile(new URL("package.json", dir), "utf8"));
  const file = (await readdir(dir)).find((f) => /^licen[cs]e/i.test(f));
  const text = file
    ? await readFile(new URL(file, dir), "utf8")
    : `Licensed under ${pkg.license}. The package includes no separate licence file.\nAuthor: ${pkg.author}\nSource: ${pkg.repository?.url}`;
  sections.push(`${name} ${pkg.version}\n\n${text.trim()}`);
}
const rule = `\n\n${"=".repeat(72)}\n\n`;
await writeFile(here("./THIRD_PARTY_NOTICES.txt"), `This extension bundles the following open-source packages.${rule}${sections.join(rule)}\n`);
await cp(here("../../LICENSE"), here("./LICENSE"));
console.log(`bundled ${names.size} packages`);
