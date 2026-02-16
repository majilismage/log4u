const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load searoute-js
const { searoute } = require('./node_modules/searoute-js');

const PORT = 8111;
const ENTRIES_FILE = './resolved-entries.json';
const ROUTES_FILE = './routes.json';
const STATE_FILE = './approved-entries.json';
const HTML_FILE = './review.html';

// Load data
let entries = [];
let routes = [];
let state = { approved: [], skipped: [], flagged: [] };

function loadData() {
    try {
        entries = JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8'));
        routes = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
        console.log(`Loaded ${entries.length} entries and ${routes.length} routes`);
    } catch (err) {
        console.error('Error loading data:', err.message);
        process.exit(1);
    }
    
    // Load state if exists
    try {
        if (fs.existsSync(STATE_FILE)) {
            state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            console.log(`Loaded state: ${state.approved.length} approved, ${state.skipped.length} skipped, ${state.flagged.length} flagged`);
        }
    } catch (err) {
        console.log('No existing state file, starting fresh');
    }
}

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function mergeEntryWithRoute(entry) {
    const route = routes.find(r => r.index === entry.index);
    return {
        ...entry,
        route: route ? route.route : null,
        searouteDistNm: route ? route.searouteDistNm : null,
        distRatio: route ? route.distRatio : null
    };
}

function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        if (pathname === '/' && req.method === 'GET') {
            // Serve HTML
            if (fs.existsSync(HTML_FILE)) {
                const html = fs.readFileSync(HTML_FILE, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('review.html not found');
            }
        } else if (pathname === '/api/entries' && req.method === 'GET') {
            // Return all entries merged with routes
            const mergedEntries = entries.map(mergeEntryWithRoute);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mergedEntries));
        } else if (pathname === '/api/progress' && req.method === 'GET') {
            // Return current review state
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state));
        } else if (pathname === '/api/approve' && req.method === 'POST') {
            // Approve entry
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { index, fromLat, fromLng, toLat, toLng, notes } = data;
                    
                    // Update entry coordinates if provided
                    const entry = entries.find(e => e.index === index);
                    if (entry) {
                        if (fromLat !== undefined) entry.fromLat = fromLat;
                        if (fromLng !== undefined) entry.fromLng = fromLng;
                        if (toLat !== undefined) entry.toLat = toLat;
                        if (toLng !== undefined) entry.toLng = toLng;
                        if (notes !== undefined) entry.notes = notes;
                    }
                    
                    // Add to approved list if not already there
                    if (!state.approved.includes(index)) {
                        state.approved.push(index);
                    }
                    
                    // Remove from skipped/flagged if present
                    state.skipped = state.skipped.filter(i => i !== index);
                    state.flagged = state.flagged.filter(item => 
                        (typeof item === 'object' ? item.index : item) !== index
                    );
                    
                    saveState();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else if (pathname === '/api/skip' && req.method === 'POST') {
            // Skip entry
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { index } = data;
                    
                    if (!state.skipped.includes(index)) {
                        state.skipped.push(index);
                    }
                    
                    // Remove from approved/flagged if present
                    state.approved = state.approved.filter(i => i !== index);
                    state.flagged = state.flagged.filter(item => 
                        (typeof item === 'object' ? item.index : item) !== index
                    );
                    
                    saveState();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else if (pathname === '/api/flag' && req.method === 'POST') {
            // Flag entry
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { index, reason } = data;
                    
                    // Remove existing flag for this index
                    state.flagged = state.flagged.filter(item => 
                        (typeof item === 'object' ? item.index : item) !== index
                    );
                    
                    // Add new flag
                    state.flagged.push({ index, reason });
                    
                    // Remove from approved/skipped if present
                    state.approved = state.approved.filter(i => i !== index);
                    state.skipped = state.skipped.filter(i => i !== index);
                    
                    saveState();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else if (pathname === '/api/recalc-route' && req.method === 'POST') {
            // Recalculate route using searoute-js
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { index, fromLat, fromLng, toLat, toLng } = data;
                    
                    // Calculate new route
                    const startPoint = [fromLng, fromLat];
                    const endPoint = [toLng, toLat];
                    
                    try {
                        const newRoute = searoute(startPoint, endPoint, { units: 'nauticalmiles' });
                        
                        // Update route in routes array
                        const routeIndex = routes.findIndex(r => r.index === index);
                        if (routeIndex !== -1) {
                            routes[routeIndex].route = newRoute.geometry;
                            routes[routeIndex].searouteDistNm = newRoute.properties.length;
                        }
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            route: newRoute.geometry,
                            distance: newRoute.properties.length
                        }));
                    } catch (searouteErr) {
                        console.error('Searoute error:', searouteErr.message);
                        // Fallback to straight line
                        const straightLine = {
                            type: 'LineString',
                            coordinates: [startPoint, endPoint]
                        };
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            route: straightLine,
                            distance: null,
                            warning: 'Used straight line fallback'
                        }));
                    }
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    } catch (err) {
        console.error('Request error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
}

// Initialize
loadData();

// Create server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`Review server running on http://localhost:${PORT}`);
    console.log('Ready to review entries!');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});