// Copies the site's converters into the package, so the site and the package can't drift apart.
import { cp, rm } from "node:fs/promises";

const here = (path) => new URL(path, import.meta.url);

await rm(here("./lib/"), { recursive: true, force: true });
await cp(here("../../src/lib/"), here("./lib/"), { recursive: true });
await cp(here("../../LICENSE"), here("./LICENSE"));
