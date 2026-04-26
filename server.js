const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

const port = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    // Health check для Render
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    // Определяем целевой URL
    let target = req.url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'http://' + (req.headers.host || 'localhost') + req.url;
    }

    const parsed = url.parse(target);
    if (!parsed.host) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: missing host');
        return;
    }

    // Проксируем без авторизации
    proxy.web(req, res, {
        target: parsed.protocol + '//' + parsed.host,
        changeOrigin: true,
        followRedirects: true
    });
});

// Поддержка HTTPS через CONNECT
server.on('connect', (req, clientSocket, head) => {
    const [hostname, port] = req.url.split(':');
    const targetSocket = require('net').connect(port || 443, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        targetSocket.write(head);
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
        console.error('CONNECT error:', err.message);
        clientSocket.end();
    });
});

// Самопинг каждые 10 минут
setInterval(() => {
    http.get(`http://localhost:${port}/ping`, (res) => {
        console.log('Self-ping OK');
    }).on('error', (e) => {
        console.error('Self-ping failed:', e.message);
    });
}, 10 * 60 * 1000);

server.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});
