// Tells Bing and the other IndexNow engines which pages exist. Run after a deploy, once the key file is live.
import { readFile } from "node:fs/promises";
import { INDEXNOW_KEY, SITE } from "./src/site.js";

const sitemap = await readFile(new URL("./dist/sitemap.xml", import.meta.url), "utf8");
const urlList = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map((match) => match[1]);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
});
console.log(`IndexNow answered ${response.status} for ${urlList.length} URLs`);
