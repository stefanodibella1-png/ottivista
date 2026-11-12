require("http").createServer((q, r) => { let b = ""; q.on("data", c => b += c); q.on("end", () => { console.log("SMS", b); r.end("ok"); }); }).listen(8899);
