const http = require('http');
const net = require('net');

const AUTH = { user: '', pass: '' }; // без авторизации

const server = http.createServer((req, res) => {
    if (req.url === '/ping' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('pong');
        return;
    }
    // HTTP-прокси как обычно
    const options = new URL(req.url);
    const req2 = http.request({ host: options.hostname, port: options.port || 80, path: options.pathname + options.search, method: req.method, headers: req.headers }, (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
    });
    req.pipe(req2);
});

// SOCKS5 через тот же порт (используется для CONNECT)
server.on('connect', (req, clientSocket, head) => {
    const [hostname, port] = req.url.split(':');
    const targetSocket = net.connect(port || 443, hostname, () => {
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

// Самопинг
setInterval(() => {
    http.get(`http://localhost:${process.env.PORT || 8080}/ping`, (res) => res.resume()).on('error', () => {});
}, 10 * 60 * 1000);

server.listen(process.env.PORT || 8080, () => {
    console.log(`Proxy (HTTP/SOCKS5) running on port ${process.env.PORT || 8080}`);
});
