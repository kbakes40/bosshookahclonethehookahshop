import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pub = path.join(root, "client", "public");
const out = path.join(pub, "favicon.ico");

const layers = ["favicon-16x16.png", "favicon-32x32.png"].map(f => path.join(pub, f));
for (const f of layers) {
  if (!fs.existsSync(f)) {
    console.error("Missing", f);
    process.exit(1);
  }
}

const buf = await pngToIco(layers);
fs.writeFileSync(out, buf);
console.log("Wrote", out, `(${buf.length} bytes)`);
