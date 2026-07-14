const { Jimp } = require('jimp');
const fs = require('fs');

async function autocropLogo() {
  const imagePath = 'c:/Users/New/OneDrive/Desktop/trade-easy/frontend/public/Artboard_15_4x-100_1_-removebg-preview.png';
  try {
    const image = await Jimp.read(imagePath);
    image.autocrop();
    await image.write(imagePath);
    console.log("Logo successfully autocropped and saved.");
  } catch (error) {
    console.error("Error cropping image:", error);
  }
}

autocropLogo();
