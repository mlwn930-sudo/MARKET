import { expect, test } from "@playwright/test";

test("cinematic scenes render, change through scrolling, and retain a direct research exit",async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:width===1440?1000:844});
    for(const [route,root,canvas,distance] of [["/",".wall-street-portal",".portal-canvas",width<800?820:1500],["/launch/ttwo",".gta-fracture",".fracture-canvas",width<800?510:900]] as const){
      await page.goto(route);
      await expect(page.locator(root)).toHaveAttribute("data-webgl","true");
      await page.waitForTimeout(2500);
      const first=await page.locator(canvas).screenshot();
      for(let i=0;i<8;i++){await page.mouse.wheel(0,distance/8);await page.waitForTimeout(80);}
      await page.waitForTimeout(900);
      expect((await page.locator(canvas).screenshot()).equals(first)).toBe(false);
      expect((await page.locator(canvas).boundingBox())!.y).toBeGreaterThanOrEqual(100);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.locator(route==="/"?".portal-top a":".fracture-top a").click();
      await expect(page.locator(route==="/"?"#market-data":"#investment")).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test("reduced motion keeps static imagery and removes cinematic pinning",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const [route,root] of [["/",".wall-street-portal"],["/launch/ttwo",".gta-fracture"]]){
    await page.goto(route);
    await expect(page.locator(root)).not.toHaveAttribute("data-webgl","true");
    await expect(page.locator(root+" img")).toBeVisible();
    await expect(page.locator(root+" .pin-spacer")).toHaveCount(0);
  }
});
