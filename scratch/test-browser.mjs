import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  console.log("Loading Wink Dev Kit with Anonymous template...");
  await page.goto("http://127.0.0.1:8787/?url=http://127.0.0.1:5173", { waitUntil: "networkidle2" });
  
  await new Promise(r => setTimeout(r, 3000));
  
  const frame = page.frames().find(f => f !== page.mainFrame());
  if (frame) {
    console.log("Found game iframe:", frame.url());
    
    // Evaluate if bridge is ready
    const phase = await frame.evaluate(() => window.WinkBridge?.getState().phase);
    console.log("WinkBridge Phase:", phase); 
    
    // Evaluate score text from UI
    const scoreText = await frame.evaluate(() => document.querySelector(".blockblast-info-panel")?.textContent);
    console.log("HUD Text:", scoreText);
  } else {
    console.log("No iframe found");
  }

  await browser.close();
  process.exit(0);
})();
