import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto("http://127.0.0.1:8787/?url=http://127.0.0.1:5173", { waitUntil: "networkidle2" });
  
  console.log("Page loaded");
  await new Promise(r => setTimeout(r, 2000));
  
  // Wait for the iframe
  const frame = page.frames().find(f => f.url().includes('5173'));
  if (frame) {
    console.log("Found game iframe:", frame.url());
    
    // Evaluate if bridge is ready
    const phase = await frame.evaluate(() => window.WinkBridge?.getState().phase);
    console.log("WinkBridge Phase:", phase);
    
    const scoreText = await frame.evaluate(() => document.querySelector(".blockblast-info-panel")?.textContent);
    console.log("HUD Text:", scoreText);
  } else {
    console.log("No iframe found");
  }

  await browser.close();
})();
