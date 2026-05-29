const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = path.join(__dirname, "db.json");
const PUBLIC_DIR = __dirname;

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return {
      profiles: {},
      attempts: [],
      dailySeed: new Date().toISOString().slice(0, 10),
    };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  }[ext] || "application/octet-stream";
}

function sendStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR) || filePath === DB_PATH) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallbackData);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function leaderboard(db) {
  const bestByPlayer = new Map();
  for (const attempt of db.attempts) {
    const key = attempt.email || attempt.name;
    const current = bestByPlayer.get(key);
    if (!current || attempt.score > current.score) bestByPlayer.set(key, attempt);
  }

  const saved = [...bestByPlayer.values()];
  const demo = [
    { name: "Aruzhan", city: "Almaty", score: 5140 },
    { name: "Miras", city: "Astana", score: 4880 },
    { name: "Dana", city: "Shymkent", score: 4620 },
    { name: "Timur", city: "Kyzylorda", score: 4410 },
  ];

  return saved
    .concat(demo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      send(res, 200, { ok: true, service: "NeuroSudoku API" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/daily") {
      const date = new Date().toISOString().slice(0, 10);
      send(res, 200, { date, seed: `daily-${date}` });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/leaderboard") {
      send(res, 200, { leaderboard: leaderboard(db) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const email = url.searchParams.get("email");
      send(res, 200, { profile: email ? db.profiles[email] || null : null });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/profile") {
      const profile = await readBody(req);
      const email = profile.email || "player@neurosudoku.app";
      db.profiles[email] = { ...db.profiles[email], ...profile, email, updatedAt: new Date().toISOString() };
      writeDb(db);
      send(res, 200, { profile: db.profiles[email] });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/attempts") {
      const attempt = await readBody(req);
      const saved = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        ...attempt,
      };
      db.attempts.unshift(saved);
      db.attempts = db.attempts.slice(0, 250);
      writeDb(db);
      send(res, 200, { attempt: saved, leaderboard: leaderboard(db) });
      return;
    }

    if (req.method === "GET") {
      sendStatic(req, res);
      return;
    }

    send(res, 404, { error: "Not found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NeuroSudoku running on http://${HOST}:${PORT}`);
});
