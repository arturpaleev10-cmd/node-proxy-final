const http = require('http');
const httpProxy = require('http-proxy');

const port = process.env.PORT || 8080;
const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    // Health check для Render (отвечаем на любые простые проверки)
    if (req.url === '/ping' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }

    // Проксируем запрос. req.url уже содержит полный URL, если клиент использует HTTP-прокси
    proxy.web(req, res, {
        target: req.url,
        changeOrigin: true,
        followRedirects: true
    });
});

// Поддержка HTTPS (CONNECT)
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

// Самопинг, чтобы Render не засыпал
setInterval(() => {
    http.get(`http://localhost:${port}/ping`, (res) => { res.resume(); }).on('error', () => {});
}, 10 * 60 * 1000);

server.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});
