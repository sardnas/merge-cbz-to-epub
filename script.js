const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');
const tmp = require('tmp');
const Epub = require('epub-gen');
const sharp = require('sharp');

// Kobo Libra Colour screen dimensions
const MAX_WIDTH = 1264;
const MAX_HEIGHT = 1650;

const inputFolder = process.argv[2];
if (!inputFolder) {
  console.error("Usage: node script.js <folder_with_cbz_files>");
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
    const chapterName = path.basename(cbzFile, '.cbz');
    const chapterDir = path.join(tmpDir.name, chapterName);

    zip.extractAllTo(chapterDir, true);

    let images = (await fs.readdir(chapterDir))
      .filter(file => /\.(jpe?g|png|gif)$/i.test(file))
      .sort();

    const convertedImages = [];

    for (const [index, image] of images.entries()) {
      const imgPath = path.join(chapterDir, image);
      const newImageName = `${String(index).padStart(3, '0')}.jpg`;
      const newImagePath = path.join(chapterDir, newImageName);

      try {
        await sharp(imgPath)
          .resize({
            width: MAX_WIDTH,
            height: MAX_HEIGHT,
            fit: 'inside',
          })
          .jpeg({ quality: 85 })
          .toFile(newImagePath);

        convertedImages.push(newImageName);

        if (imgPath !== newImagePath) {
          await fs.remove(imgPath);
        }
      } catch (err) {
        console.warn(`Could not process image: ${imgPath}`, err.message);
      }
    }

    const htmlContent = convertedImages.map(img =>
      `<img src="${path.join(chapterDir, img)}" style="max-height: 100vh; max-width: 100vw; height: auto; width: auto; display: block; margin: auto;" />`
    ).join('');

    chapters.push({
      title: chapterName,
      data: htmlContent,
    });
  }

  const folderName = path.basename(path.resolve(inputFolder));
  const outputEpub = path.join(process.cwd(), `${folderName}.epub`);

  const option = {
    title: folderName,
    author: "Author",
    content: chapters,
  };

  console.log("Generating EPUB...");
  await new Epub(option, outputEpub).promise;
  console.log("✅ EPUB created at:", outputEpub);

  tmpDir.removeCallback();
})();
