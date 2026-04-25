const http = require('http');
const httpProxy = require('http-proxy');

const port = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({});

const AUTH_USER = 'user';
const AUTH_PASS = 'password';

// Проверка Basic Auth
function checkAuth(req) {
    const auth = req.headers['proxy-authorization'];
    if (!auth) return false;
    const expected = 'Basic ' + Buffer.from(AUTH_USER + ':' + AUTH_PASS).toString('base64');
    return auth === expected;
}

const server = http.createServer((req, res) => {
    // Health check — всегда открыт
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    // Требуем авторизацию
    if (!checkAuth(req)) {
        res.writeHead(407, {
            'Proxy-Authenticate': 'Basic realm="Proxy"'
        });
        res.end('Authentication required');
        return;
    }

    // Проксируем запрос как есть
    proxy.web(req, res, {
        target: req.url,
        changeOrigin: true,
        followRedirects: true
    });
});

// Поддержка HTTPS CONNECT
server.on('connect', (req, clientSocket, head) => {
    if (!checkAuth(req)) {
        clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');
        clientSocket.end();
        return;
    }

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

// Самопинг каждые 10 минут для предотвращения сна
setInterval(() => {
    http.get(`http://localhost:${port}/ping`, (res) => {
        console.log('Self-ping OK');
    }).on('error', (e) => {
        console.error('Self-ping failed:', e.message);
    });
}, 10 * 60 * 1000);
