import { Parcel } from "@parcel/core";
import fs from "fs";
import url from "url";
import fetch, { File, FormData, Headers } from "node-fetch";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const manifestFileTypes = [".js"];
const allowedFileTypes = /^.*(\.js|\.js\.map|\.css)$/;

export default async (bundlerSettings) => {
  let bundler = new Parcel({
    entries: "src/Header.tsx",
    config: `${__dirname}../.parcelrc`,

    mode: "production",
    targets: {
      modern: {
        includeNodeModules: {
          react: false,
          "react-dom": false,
        },
        distDir: "./dist",
      },
    },
    ...(typeof bundlerSettings === "object" ? bundlerSettings : {}),
  });

  try {
    fs.rmSync("./dist", { recursive: true, force: true });

    let { bundleGraph, buildTime } = await bundler.run();
    let bundles = bundleGraph.getBundles();

    const str = fs
      .readdirSync("./dist")
      .filter(
        (file) => file !== "manifest.js" && file.endsWith(manifestFileTypes[0])
      )
      .map((file) => file.replace(manifestFileTypes[0], ""))
      .map(
        (file) =>
          `  '${
            file.split(".")[0]
          }': () => ({ loader: import('./${file}'), type: 'js' }),`
      )
      .join("\n");
    const manifest = `export default {\n${str}\n};`;
    fs.writeFileSync("./dist/manifest.js", manifest);

    console.log(`✨ Built ${bundles.length} bundles in ${buildTime}ms!`);

    const uploadStart = Date.now();
    const uploads = fs.readdirSync("./dist").map((file) => {
      const form = new FormData();
      form.append("file", fs.readFileSync(`./dist/${file}`));
      form.append("filename", file);

      return fetch("http://localhost:3000/api/bundle-file", {
        method: "POST",
        body: form,
      });
    });

    await Promise.all(uploads);
    console.log(
      `⬆️ Uploaded ${uploads.length} files in ${Date.now() - uploadStart}ms!`
    );
  } catch (err) {
    console.log("Error", err);
  }
};
