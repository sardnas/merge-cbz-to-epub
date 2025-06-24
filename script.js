const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');
const tmp = require('tmp');
const Epub = require('epub-gen');

const inputFolder = process.argv[2];
if (!inputFolder) {
  console.error("Usage: node cbz-to-epub.js <folder_with_cbz_files>");
  process.exit(1);
}

(async () => {
  const cbzFiles = (await fs.readdir(inputFolder))
    .filter(file => file.toLowerCase().endsWith('.cbz'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  const chapters = [];

  for (const cbzFile of cbzFiles) {
    const fullPath = path.join(inputFolder, cbzFile);
    const zip = new AdmZip(fullPath);
    const chapterDir = path.join(tmpDir.name, path.basename(cbzFile, '.cbz'));

    zip.extractAllTo(chapterDir, true);
    const images = (await fs.readdir(chapterDir))
      .filter(file => /\.(jpe?g|png|gif)$/i.test(file))
      .sort();

    const htmlContent = images.map(img =>
    `<img src="${path.join(chapterDir, img)}" style="max-width:100%; max-height:100vh; width:auto; height:auto; display:block; margin:auto;" />`
    ).join('');
      
    chapters.push({
      data: htmlContent,
    });
  }

  const outputEpub = path.join(process.cwd(), 'output.epub');
  const option = {
    title: "Title",
    author: "Author",
    content: chapters,
  };

  console.log("Generating EPUB...");
  await new Epub(option, outputEpub).promise;
  console.log("EPUB created at:", outputEpub);

  tmpDir.removeCallback();
})();
