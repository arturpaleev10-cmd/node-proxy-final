const http = require('http');
const httpProxy = require('http-proxy');

const port = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    // Health check
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    // Проксируем запрос без авторизации
    proxy.web(req, res, {
        target: req.url,
        changeOrigin: true,
        followRedirects: true
    });
});

// Поддержка HTTPS CONNECT (без авторизации)
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

server.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});

// Самопинг каждые 10 минут
setInterval(() => {
    http.get(`http://localhost:${port}/ping`, (res) => {
        console.log('Self-ping OK');
    }).on('error', (e) => {
        console.error('Self-ping failed:', e.message);
    });
}, 10 * 60 * 1000);
