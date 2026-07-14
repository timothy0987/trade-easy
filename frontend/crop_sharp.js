const sharp = require('sharp');
const path = 'c:/Users/New/OneDrive/Desktop/trade-easy/frontend/public/Artboard_15_4x-100_1_-removebg-preview.png';

async function crop() {
    try {
        await sharp(path)
            .trim()
            .toFile('c:/Users/New/OneDrive/Desktop/trade-easy/frontend/public/temp.png');
        const fs = require('fs');
        fs.renameSync('c:/Users/New/OneDrive/Desktop/trade-easy/frontend/public/temp.png', path);
        console.log("Success");
    } catch (e) {
        console.error("Sharp failed", e);
    }
}
crop();
