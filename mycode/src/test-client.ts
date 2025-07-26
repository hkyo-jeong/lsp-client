import * as cp from 'child_process';
import { DocumentUri } from 'vscode-languageserver-types';
import { InitializeParams } from 'vscode-languageserver-protocol';
import * as util from 'util';
import * as fs from 'fs';


const childProcess = cp.spawn('tsx', ['test-server.ts', '--stdio']);
// const childProcess = cp.spawn('node', ['/Users/hkyo/hkyo_config/codes/pyright/packages/pyright/dist/pyright-langserver.js', '--stdio']);

let cachedBuffer: Buffer = Buffer.alloc(0);
let jsonrpcLength = 0;
let messageLength = 0;
let messageStartIdx = 0;

function parseJsonRpcHeader(buffer:Buffer) {
	const lengthHeader = 'Content-Length: ';
	const contentLengthStr = buffer.subarray(0, 16).toString();
	if(contentLengthStr != lengthHeader) {
		console.log(`invalid content header length : ${contentLengthStr}`);
		return false;
	}
	const CRidx = buffer.findIndex((v) => v == '\r'.charCodeAt(0));
	if(CRidx < 0) {
		console.log(`There is no CR yet`);
		return false;
	}

	messageLength = Number(buffer.subarray(16, CRidx));
	messageStartIdx = CRidx + 4;
	jsonrpcLength = messageStartIdx + messageLength;

	// console.log('*************************************************');
	// console.log('cache len : ' + contentLengthStr.length);
	// console.log(`content : ${contentLengthStr}`);
	// console.log(`jsonrpcLength : ${jsonrpcLength}`);
	// console.log(`messageStartIdx : ${messageStartIdx}`);
	// console.log(`messageLength : ${messageLength}`);
	// console.log('\\r idx : ' + CRidx);
	// console.log('*************************************************');

	return true;
}

function getJsonRpcHeaderAndMessage(buffer:Buffer) {
	const message = cachedBuffer.subarray(messageStartIdx, jsonrpcLength).toString('utf8');
	const header = cachedBuffer.subarray(0, messageStartIdx-4).toString('utf8');
	
	cachedBuffer = cachedBuffer.subarray(jsonrpcLength);
	messageLength = 0;
	messageStartIdx = 0;
	jsonrpcLength = 0;

	return [header, message];
}

childProcess.stdout.on('data', (data: Buffer) => {
	cachedBuffer = Buffer.concat([cachedBuffer, data]);

	console.log('-----------------------------------------');

	while(1) {
		if(cachedBuffer.length < 16) {
			break;
		}

		if (messageLength == 0) {
			parseJsonRpcHeader(cachedBuffer);
		}

		if(jsonrpcLength > cachedBuffer.length) {
			break;
		}

		const ret = getJsonRpcHeaderAndMessage(cachedBuffer);

		console.log(`header : ${ret[0]}`);
		console.log(`message : ${util.inspect(JSON.parse(ret[1]), false, null, false)}`);
	}
});

// childProcess.stderr.on('data', (data) => {
// 	console.log(`stderr : ${data.toString('utf8')}`);
// });

//#########################################################################################################################################



import * as rpc from 'vscode-jsonrpc/node';
import { DidOpenTextDocumentNotification, DidOpenTextDocumentParams} from 'vscode-languageserver-protocol';
// import { BaseLanguageClient, MessageTransports } from 'vscode-languageclient';

// class LanguageClient extends BaseLanguageClient {
// 	protected async createMessageTransports(encoding: string): Promise<MessageTransports> {
// 		const reader = new rpc.StreamMessageReader(childProcess.stdout);
// 		const writer = new rpc.StreamMessageWriter(childProcess.stdin);
// 		return { reader, writer };
// 	}


// }

const rootUri: DocumentUri = "file:///Users/hkyo/hkyo_config/codes/python";
const fileUri: DocumentUri = "file:///Users/hkyo/hkyo_config/codes/python/test.py";

const initializeParam: InitializeParams = {
	rootUri: rootUri,
	rootPath: '/Users/hkyo/hkyo_config/codes/python',
	capabilities: {},
	trace: "verbose"
};

const didOpenRequest:DidOpenTextDocumentParams = {
	textDocument: {
		uri: fileUri,
		languageId: 'python',
		version: 0,
		text: fs.readFileSync('/Users/hkyo/hkyo_config/codes/python/test.py').toString()
	}
}; 

const connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(childProcess.stdout),
	new rpc.StreamMessageWriter(childProcess.stdin));

// const notification = new rpc.NotificationType<string>('testNotification');

connection.onError((e) => {
	console.log('--- error ---');
	console.log(e);
});

connection.listen();

// const initializeStr = JSON.stringify(initializeParam);

console.log('-- initialize param --');
console.log(initializeParam);

connection.sendRequest('initialize', initializeParam);

connection.sendNotification('initialized');

setTimeout(() => {
	connection.sendNotification(DidOpenTextDocumentNotification.method, didOpenRequest);
	// connection.sendRequest('custom/call');
}, (2000));

// connection.onRequest('message', (data) => {
// 	console.log('-- message --');
// 	console.log(data);
// });
// setTimeout(() => {
// 	console.log('\n-- pending response --');
// 	console.log(connection.hasPendingResponse());
// }, 2000);