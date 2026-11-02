import { test } from "@playwright/test";
test("diag webkit", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit");
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  await page.addInitScript(() => {
    const W = window.Worker;
    (window as any).Worker = class extends W {
      constructor(u: any, o: any) {
        super(u, o);
        this.addEventListener("message", (e: MessageEvent) => {
          const d = e.data;
          if (d && d.ok === false) console.log("WORKER-ERR", d.id, d.error);
          else if (d && d.id <= 3) console.log("WORKER-OK", d.id, Object.keys(d.result ?? {}).join(","));
        });
        this.addEventListener("error", (e: any) => console.log("WORKER-ONERROR", e.message));
        const post = this.postMessage.bind(this);
        this.postMessage = (m: any, t?: any) => { if (m?.id <= 3) console.log("WORKER-REQ", m.id, m.command, m.system); return post(m, t); };
      }
    };
  });
  await page.goto("/");
  await page.getByRole("article", { name: "Game Boy", exact: true }).getByRole("button", { name: "Probar demo" }).click();
  await page.waitForTimeout(3000);
  const opfs = await page.evaluate(async () => {
    const out: string[] = [];
    try {
      const root = await navigator.storage.getDirectory();
      out.push("getDirectory ok");
      const dir = await root.getDirectoryHandle("diag", { create: true });
      const fh = await dir.getFileHandle("a", { create: true });
      out.push("file ok; createWritable=" + typeof (fh as any).createWritable + " sync=" + typeof (fh as any).createSyncAccessHandle);
      const code = `onmessage=async()=>{try{const r=await navigator.storage.getDirectory();const d=await r.getDirectoryHandle("diag",{create:true});const f=await d.getFileHandle("b",{create:true});const h=await f.createSyncAccessHandle();h.truncate(0);const n=h.write(new Uint8Array([1,2,3]),{at:0});h.flush();h.close();const file=await f.getFile();postMessage("worker sync ok n="+n+" size="+file.size)}catch(e){postMessage("worker err "+e.name+": "+e.message)}}`;
      const w = new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
      out.push(await new Promise<string>((r) => { w.onmessage = (e) => r(e.data); w.postMessage(0); }));
    } catch (e: any) { out.push("err " + e.name + ": " + e.message); }
    return out;
  });
  console.log("DIAG opfs", JSON.stringify(opfs));
  console.log("DIAG logs", JSON.stringify(logs.filter((l) => !l.includes("[vite]")).slice(0, 30)));
});
