import * as cp from 'child_process';
import { DocumentUri, Position, TextDocumentIdentifier } from 'vscode-languageserver-types';
import { InitializeParams, InitializedNotification, DocumentSymbolParams, DocumentSymbolRequest, DefinitionRequest, DidOpenTextDocumentNotification, DidOpenTextDocumentParams, DefinitionParams, DidChangeWatchedFilesParams, InitializeRequest } from 'vscode-languageserver-protocol';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const langServerPath = '/Users/hkyo/hkyo_config/codes/pyright/packages/pyright/dist/pyright-langserver.js';

// const childProcess = cp.spawn('tsx', ['test-server.ts', '--stdio']);
const childProcess = cp.spawn('node', [langServerPath, '--stdio']);

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

	while(cachedBuffer.length >= 16) {
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

function toFileUri(absolutePath:string) {
	return `file://${absolutePath}`;
}

//#########################################################################################################################################

import { watch, FSWatcher } from 'chokidar';

function run_watcher(dirpath:string) {
	const watcher: FSWatcher = watch(dirpath, {
		persistent: true,
		ignoreInitial: true,
	});


	const watchedFilesParam: DidChangeWatchedFilesParams = {
		changes: []
	};

	watcher
	.on('add', (path:string) => console.log(`File ${path} has been added`))
	.on('change', (path:string) => console.log(`File ${path} has been changed`))
	.on('unlink', (path:string) => console.log(`File ${path} has been removed`));
}


//#########################################################################################################################################

import * as rpc from 'vscode-jsonrpc/node';
// import { BaseLanguageClient, MessageTransports } from 'vscode-languageclient';

// class LanguageClient extends BaseLanguageClient {
// 	protected async createMessageTransports(encoding: string): Promise<MessageTransports> {
// 		const reader = new rpc.StreamMessageReader(childProcess.stdout);
// 		const writer = new rpc.StreamMessageWriter(childProcess.stdin);
// 		return { reader, writer };
// 	}


// }

const rootPath = "/Users/hkyo/hkyo_config/codes/python";
const rootUri: DocumentUri = toFileUri(rootPath);
const fileUri: DocumentUri = toFileUri(path.join(rootPath, 'test.py'));
const file2Uri: DocumentUri = toFileUri(path.join(rootPath, 'test2.py'));


const initializeParam: InitializeParams = {
	processId: process.pid,
	rootUri: rootUri,
	rootPath: '/Users/hkyo/hkyo_config/codes/python',
	capabilities: {},
	trace: "verbose"
};

run_watcher(rootPath);

const connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(childProcess.stdout),
	new rpc.StreamMessageWriter(childProcess.stdin)
);

// const notification = new rpc.NotificationType<string>('testNotification');

connection.onError((e) => {
	console.log('--- error ---');
	console.log(e);
});

connection.listen();

// const initializeStr = JSON.stringify(initializeParam);

console.log('-- initialize param --');
console.log(initializeParam);

connection.sendRequest(InitializeRequest.method, initializeParam);

connection.sendNotification(InitializedNotification.method);

setTimeout(() => {
	const didOpenRequest:DidOpenTextDocumentParams = {
		textDocument: {
			// uri: fileUri,
			uri: file2Uri,
			languageId: 'python',
			version: 0,
			// text: fs.readFileSync(filePath).toString()
			text:`import test1

c3 = test1.test_function()
print(c3)`
		}
	}; 

	console.log('----- did open text document ----');
	console.log('* send did open text document');
	connection.sendNotification(DidOpenTextDocumentNotification.method, didOpenRequest);
}, (2000));




setTimeout(() => {
	const documentSymbolParam:DocumentSymbolParams = {
		textDocument: TextDocumentIdentifier.create(fileUri)
	};

	console.log('----- document symbol ----');
	console.log('* send document symbol');
	connection.sendRequest(DocumentSymbolRequest.method, documentSymbolParam);
}, (4000));




// setTimeout(() => {
// 	const definitionRequest:DefinitionParams = {
// 		// textDocument: TextDocumentIdentifier.create(fileUri),
// 		// position: Position.create(50, 12)
		
// 		textDocument: TextDocumentIdentifier.create(fileUri),
// 		position: Position.create(51, 0)
		
		
// 		// textDocument: TextDocumentIdentifier.create(file2Uri),
// 		// position: Position.create(2, 12)
// 	};

// 	console.log('----- definition request ----');
// 	console.log('* send definition request');
// 	connection.sendRequest(DefinitionRequest.method, definitionRequest);
// }, (4000));




// connection.onRequest('message', (data) => {
// 	console.log('-- message --');
// 	console.log(data);
// });
// setTimeout(() => {
// 	console.log('\n-- pending response --');
// 	console.log(connection.hasPendingResponse());
// }, 2000);