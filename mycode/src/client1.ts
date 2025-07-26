import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

// Spawn a child process (the language server)
// const childProcess = cp.spawn('your-language-server', [], { stdio: 'pipe' });

const childProcess = cp.spawn('/Users/hkyo/.nvm/versions/node/v21.1.0/bin/tsx', ['server1.ts']);

// Use stdin and stdout for communication:
const connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(childProcess.stdout),
	new rpc.StreamMessageWriter(childProcess.stdin));

const notification = new rpc.NotificationType<string>('testNotification');

connection.listen();

connection.sendNotification(notification, 'Hello World');