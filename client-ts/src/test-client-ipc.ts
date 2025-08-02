import * as cp from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { InitializeParams, InitializedNotification, DocumentSymbolParams, DocumentSymbolRequest, DefinitionRequest, DidOpenTextDocumentNotification, DidOpenTextDocumentParams, DefinitionParams, DidChangeWatchedFilesParams, InitializeRequest, DocumentUri } from 'vscode-languageserver-protocol';

const langServerPath = '/Users/hkyo/hkyo_config/codes/pyright/packages/pyright/dist/pyright-langserver.js';

const childProcess = cp.fork(langServerPath, ['--node-ipc']);

// 자식으로부터 메시지 받기
childProcess.on('message', (msg) => {
    console.log('Parent received:', msg);
});

// 자식 종료 이벤트
childProcess.on('exit', (code) => {
    console.log('Child exited with code', code);
});


const connection = rpc.createMessageConnection(
	new rpc.IPCMessageReader(childProcess),
	new rpc.IPCMessageWriter(childProcess)
);

connection.listen();


function toFileUri(absolutePath:string) {
	return `file://${absolutePath}`;
}

const rootPath = "/Users/hkyo/hkyo_config/codes/python";
const rootUri: DocumentUri = toFileUri(rootPath);
const fileUri: DocumentUri = toFileUri(path.join(rootPath, 'test.py'));
const file2Uri: DocumentUri = toFileUri(path.join(rootPath, 'test2.py'));

const initializeParam: InitializeParams = {
	rootPath: '/Users/hkyo/hkyo_config/codes/python',
	capabilities: {},
	trace: "verbose"
};

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