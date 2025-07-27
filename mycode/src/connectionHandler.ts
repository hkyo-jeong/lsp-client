import * as rpc from 'vscode-jsonrpc/node';
import * as cp from 'child_process';
import * as util from 'util';
import { EventEmitter } from 'stream';
import { 
	DocumentSymbolParams, 
	InitializedNotification, 
	InitializeParams, 
	DidOpenTextDocumentNotification, 
	DidOpenTextDocumentParams, 
	DocumentSymbolRequest, 
	InitializeRequest, 
	InitializeResult
} from 'vscode-languageserver-protocol';

export class ConnectionHandler {
	childProcess: cp.ChildProcessWithoutNullStreams;
	cachedBuffer: Buffer = Buffer.alloc(0);
	jsonrpcLength = 0;
	messageLength = 0;
	messageStartIdx = 0;
	connection: rpc.MessageConnection;
	emitter: EventEmitter;
	reqId: number;

	static _instance: ConnectionHandler;
	
	static getInstance(serverPath:string, emitter:EventEmitter):ConnectionHandler {
		if (!this._instance) {
			this._instance = new ConnectionHandler(serverPath, emitter);
		}

		return this._instance;
	}

	private constructor(serverPath:string, emitter: EventEmitter) {
		this.emitter = emitter;

		this.childProcess = cp.spawn('node', [serverPath, '--stdio']);

		this.childProcess.stdout.on('data', this.recieveHandler);
		// this.childProcess.stderr.on('data', this.errorHandler);

		this.connection = rpc.createMessageConnection(
			new rpc.StreamMessageReader(this.childProcess.stdout),
			new rpc.StreamMessageWriter(this.childProcess.stdin));

		this.connection.onError(this.errorHandler);

		this.reqId = 0;
		this.connection.listen();
	}

	parseJsonRpcHeader(buffer:Buffer) {
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

		this.messageLength = Number(buffer.subarray(16, CRidx));
		this.messageStartIdx = CRidx + 4;
		this.jsonrpcLength = this.messageStartIdx + this.messageLength;

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

	getJsonRpcHeaderAndMessage(buffer:Buffer) {
		const cachedBuffer = this.cachedBuffer;
		const messageStartIdx = this.messageStartIdx;
		const jsonrpcLength = this.jsonrpcLength;

		const message = cachedBuffer.subarray(messageStartIdx, jsonrpcLength).toString('utf8');
		const header = cachedBuffer.subarray(0, messageStartIdx-4).toString('utf8');
		
		this.cachedBuffer = cachedBuffer.subarray(jsonrpcLength);
		this.messageLength = 0;
		this.messageStartIdx = 0;
		this.jsonrpcLength = 0;

		return [header, message];
	}

	private recieveHandler(data: Buffer) {
		this.cachedBuffer = Buffer.concat([this.cachedBuffer, data]);

		console.log('-----------------------------------------');

		while(this.cachedBuffer.length >= 16) {
			if (this.messageLength == 0) {
				this.parseJsonRpcHeader(this.cachedBuffer);
			}

			if(this.jsonrpcLength > this.cachedBuffer.length) {
				break;
			}

			const [header, message] = this.getJsonRpcHeaderAndMessage(this.cachedBuffer);

			console.log(`header : ${header}`);
			console.log(`message : ${util.inspect(JSON.parse(message), false, null, false)}`);

			this.emitter.emit(message);
		}
	}

	private errorHandler(e:[Error, rpc.Message | undefined, number | undefined]) {
		console.log('--- error ---');
		console.log(e);
	}

	async sendInitialize(params:InitializeParams) {
		const curReqId = this.reqId;
		const promise = new Promise<InitializeResult>((resolve, reject) => {
			this.connection.sendRequest(InitializeRequest.method, params);
			this.reqId++;
		});


		

		return promise;
	}

	sendInitialized() {
		this.connection.sendNotification(InitializedNotification.method);
	}

	sendDidOpen(params:DidOpenTextDocumentParams) {
		this.connection.sendNotification(DidOpenTextDocumentNotification.method, params);
	}

	sendDocumentSymbol(params:DocumentSymbolParams) {
		this.connection.sendRequest(DocumentSymbolRequest.method, params);
	}
}
