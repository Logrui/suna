import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const outputDir = path.resolve(__dirname, "../out");
const frontendExtDir = path.resolve(
  __dirname,
  "../../../frontend/public/extension",
);
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
);

async function packExtension() {
  if (!fs.existsSync(distDir)) {
    console.error(
      "Error: dist directory not found. Please run npm run build first.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const outputName = `kortix-extension-v${pkg.version}.zip`;
  const outputPath = path.join(outputDir, outputName);
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`\n✅ Extension packed successfully!`);
    console.log(`📦 File: ${outputPath}`);
    console.log(
      `📊 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB\n`,
    );

    // Also create a "latest" symlink/copy for easy downloading
    fs.copyFileSync(
      outputPath,
      path.join(outputDir, "kortix-extension-latest.zip"),
    );

    // Copy to frontend public folder for direct download
    if (!fs.existsSync(frontendExtDir)) {
      fs.mkdirSync(frontendExtDir, { recursive: true });
    }
    const frontendZipPath = path.join(
      frontendExtDir,
      "kortix-browser-operator.zip",
    );
    fs.copyFileSync(outputPath, frontendZipPath);
    console.log(`🌐 Copied to frontend: ${frontendZipPath}`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(distDir, false);
  await archive.finalize();
}

packExtension().catch(console.error);
