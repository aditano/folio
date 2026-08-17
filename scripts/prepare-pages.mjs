import fs from "node:fs";
import path from "node:path";

const candidates = ["dist/client", "dist", ".output/public"];
const root = candidates.find((dir) => fs.existsSync(path.join("/workspace", dir)));
if (!root) {
  console.error("No static build output found. Looked for:", candidates.join(", "));
  process.exit(1);
}

const dir = path.join("/workspace", root);
const files = fs.readdirSync(dir);
console.log("pages output:", dir);
console.log(files.join("\n"));

const shell = ["_shell.html", "index.html"].map((name) => path.join(dir, name)).find((p) => fs.existsSync(p));
if (!shell) {
  console.error("No index/_shell.html in", dir);
  process.exit(1);
}

const html = fs.readFileSync(shell, "utf8");
const indexPath = path.join(dir, "index.html");
if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(dir, "404.html"), html);

const marker = path.join("/workspace", "pages-dist");
if (path.resolve(dir) !== path.resolve(marker)) {
  fs.rmSync(marker, { recursive: true, force: true });
  fs.cpSync(dir, marker, { recursive: true });
}
fs.writeFileSync(path.join(dir, ".nojekyll"), "");
if (path.resolve(dir) !== path.resolve(marker)) {
  fs.writeFileSync(path.join(marker, ".nojekyll"), "");
}
console.log("prepared", marker);
