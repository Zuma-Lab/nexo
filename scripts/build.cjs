const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
process.chdir(path.join(__dirname, ".."));
const out = "assets/runtime";
fs.mkdirSync(out, { recursive: true });
for (const [source, target] of [
  ["react/umd/react.production.min.js", "react.js"],
  ["react-dom/umd/react-dom.production.min.js", "react-dom.js"],
  ["lucide/dist/umd/lucide.js", "lucide.js"],
])
  fs.copyFileSync(path.join("node_modules", source), path.join(out, target));
for (const [pkg, file] of [
  ["react", "LICENSE"],
  ["react-dom", "LICENSE"],
  ["lucide", "LICENSE"],
]) {
  fs.copyFileSync(
    path.join("node_modules", pkg, file),
    path.join(out, pkg + "-LICENSE.txt"),
  );
}
const result = require("@babel/core").transformFileSync("app.jsx", {
  presets: [["@babel/preset-react", { runtime: "classic" }]],
  comments: false,
  compact: true,
});
fs.writeFileSync(path.join(out, "app.js"), result.code);
execFileSync(
  process.execPath,
  [
    "node_modules/tailwindcss/lib/cli.js",
    "-c",
    "tailwind.config.cjs",
    "-i",
    "scripts/tailwind.css",
    "-o",
    path.join(out, "tailwind.css"),
    "--minify",
  ],
  { stdio: "inherit" },
);
