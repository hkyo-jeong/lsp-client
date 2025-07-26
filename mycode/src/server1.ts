import * as rpc from 'vscode-jsonrpc/node';


const connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(process.stdin),
	new rpc.StreamMessageWriter(process.stdout));

const notification = new rpc.NotificationType<string>('testNotification');
connection.onNotification(notification, (param: string) => {
	console.log(param); // This prints Hello World
});

connection.listen();