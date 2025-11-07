const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_TRIES = 10;
const PUBLIC = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain'
};

function sendJSON(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

function requestHandler(req, res) {
  // Always allow CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Normalize URL (ignore query)
  const reqPath = req.url.split('?')[0];

  // API: POST /api/recipes (accept trailing slash)
  if (req.method === 'POST' && (reqPath === '/api/recipes' || reqPath === '/api/recipes/')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    return req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data || typeof data.name !== 'string' || !Array.isArray(data.ingredients) || !Array.isArray(data.instructions)) {
          res.statusCode = 400;
          return res.end('Invalid recipe payload. Required: name (string), ingredients (array), instructions (array).');
        }

        // Validate optional creation-date if provided (expect YYYY-MM-DD)
        let creationDate;
        if (data['creation-date'] !== undefined) {
          if (typeof data['creation-date'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data['creation-date'])) {
            res.statusCode = 400;
            return res.end('Invalid creation-date. Expected format YYYY-MM-DD.');
          }
          creationDate = data['creation-date'];
        } else {
          // default to today's date (YYYY-MM-DD)
          creationDate = new Date().toISOString().slice(0, 10);
        }

        const dataDir = path.join(PUBLIC, 'data');
        const filePath = path.join(dataDir, 'recipes.json');

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        let recipes = [];
        try {
          const existing = fs.readFileSync(filePath, 'utf8');
          recipes = JSON.parse(existing);
          if (!Array.isArray(recipes)) recipes = [];
        } catch (e) {
          recipes = [];
        }

        const entry = {
          name: String(data.name).trim(),
          "creation-date": creationDate,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients.map(String) : [],
          instructions: Array.isArray(data.instructions) ? data.instructions.map(String) : [],
          notes: Array.isArray(data.notes) ? data.notes.map(String) : []
        };

        recipes.push(entry);

        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(recipes, null, 2), 'utf8');
        fs.renameSync(tmpPath, filePath);

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(entry));
      } catch (err) {
        console.error('Error handling /api/recipes POST:', err);
        res.statusCode = 500;
        return res.end('Server error saving recipe.');
      }
    });
  }

  // API: DELETE /api/recipes - remove recipes by indices
  if (req.method === 'DELETE' && (reqPath === '/api/recipes' || reqPath === '/api/recipes/')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    return req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : null;
        const indices = Array.isArray(payload && payload.indices) ? payload.indices.map(Number).filter(n => Number.isInteger(n)) : null;
        if (!indices || indices.length === 0) {
          res.statusCode = 400;
          return res.end('Invalid payload: provide "indices" array of integers.');
        }

        const dataDir = path.join(PUBLIC, 'data');
        const filePath = path.join(dataDir, 'recipes.json');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        let recipes = [];
        try {
          const existing = fs.readFileSync(filePath, 'utf8');
          recipes = JSON.parse(existing);
          if (!Array.isArray(recipes)) recipes = [];
        } catch (e) {
          recipes = [];
        }

        const removeSet = new Set(indices);
        const beforeCount = recipes.length;
        const filtered = recipes.filter((_, i) => !removeSet.has(i));
        const removedCount = beforeCount - filtered.length;

        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(filtered, null, 2), 'utf8');
        fs.renameSync(tmpPath, filePath);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ removed: removedCount, remaining: filtered.length }));
      } catch (err) {
        console.error('Error handling /api/recipes DELETE:', err);
        res.statusCode = 500;
        return res.end('Server error removing recipes.');
      }
    });
  }
  
  // Serve static files
  let requested = decodeURIComponent(reqPath);
  if (requested === '/' || requested === '') requested = '/index.html';
  const safe = path.normalize(requested).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC, safe);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Try to start server, trying successive ports if the chosen one is in use
let attempts = 0;
function tryStart(port) {
  const server = http.createServer(requestHandler);

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use.`);
      attempts += 1;
      if (attempts <= MAX_PORT_TRIES) {
        const next = port + 1;
        console.log(`Trying port ${next} (${attempts}/${MAX_PORT_TRIES})...`);
        setTimeout(() => tryStart(next), 100);
      } else {
        console.error(`Unable to bind after ${MAX_PORT_TRIES} attempts. Please free port ${BASE_PORT} or set PORT env var to a different port (e.g. PORT=4000 node server.js).`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`Static server + API running at http://localhost:${port}/`);
  });
}

tryStart(BASE_PORT);
