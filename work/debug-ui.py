from pathlib import Path
p=Path('work/stage3-browser.cjs');s=p.read_text(encoding='utf-8').replace("}finally{fs.writeFileSync", "}catch(e){console.error(await page.locator('#content').innerText());await page.screenshot({path:path.join(out,'debug.png'),fullPage:true});throw e;}finally{fs.writeFileSync");p.write_text(s,encoding='utf-8')
