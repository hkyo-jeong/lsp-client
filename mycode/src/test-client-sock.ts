import * as cp from 'child_process';
import * as net from 'net';

const HOST = '127.0.0.1';
const PORT = 9000;

const langServerPath = '/Users/hkyo/hkyo_config/codes/pyright/packages/pyright/dist/pyright-langserver.js';

const childProcess = cp.fork(langServerPath, ['--socket', PORT.toString()]);

// 서버 생성
const server = net.createServer((socket) => {
    console.log('클라이언트가 연결되었습니다.');

    // 클라이언트로부터 데이터 수신
    socket.on('data', (data) => {
        console.log('클라이언트로부터 받은 데이터:', data.toString());
        // 응답 전송
        socket.write('서버가 받은 메시지: ' + data.toString());
    });

    // 연결 종료
    socket.on('end', () => {
        console.log('클라이언트 연결 종료');
    });

    // 에러 처리
    socket.on('error', (err) => {
        console.error('소켓 에러:', err);
    });
});

// 서버 시작
server.listen(PORT, HOST, () => {
    console.log(`서버가 ${HOST}:${PORT}에서 시작되었습니다.`);
});