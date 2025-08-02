import json
import os
import threading
import subprocess
from pathlib import Path
from lsprotocol import types as lsp_types, converters
from pylsp_jsonrpc.streams import JsonRpcStreamReader, JsonRpcStreamWriter
from pylsp_jsonrpc.endpoint import Endpoint
from pylsp_jsonrpc import dispatchers
from language_util import LanguageRegistry

root_path = '/Users/hkyo/hkyo_config/codes/python'
language_id = 'python'

class NotSupportedLanguageServer(Exception):
	pass

class LSPClientDispatcher(dispatchers.MethodDispatcher):
	endpoint: Endpoint
	
	def __init__(self):
		self.endpoint = None

	def set_endpoint(self, endpoint):
		self.endpoint = endpoint

	def m_window__log_message(self, **params):
		print('[logMesasge]', params)

	def m_window__show_mMessage(self, **params):
		print('[showMessage]', params)

	def m_text_docuemtn__publish_diagnostics(self, **params):
		print('[textDocument/publishDiagnostics]')
		print(json.dumps(params, index=2) + '\n')

	def handle_no_response(self, method, params):
		print(f'[no handler] method : {method}')
		print(json.dumps(params, indet=2) + '\n')

	def request(self, msg, params):
		return self.endpoint.request(msg, params)

	def notify(self, msg, params):
		self.endpoint.notify(msg, params)

	def convert_unstructure(self, params, typeof=None):
		return converters.get_converter().unstructure(params, type(params) if typeof is None else typeof)
	
	def convert_structure(self, params, typeof):
		return converters.get_converter().structure(params, typeof)
	
	def handle_initialize_response(self, future):
		try:
			result = future.result()
			print(f"[initialize result] {json.dumps(result, indent=2)}")
			print('[notify:initialized]')
			self.endpoint.notify(lsp_types.INITIALIZED)
			return result
		except Exception as e:
			print(f'[initialize Error] {str(e)}')

	def send_initialize(self, root_path):
		root_uri = Path(root_path).as_uri()

		params = lsp_types.InitializeParams(
			capabilities=lsp_types.ClientCapabilities(),
			process_id=os.getpid(),
			root_uri=root_uri,
			trace='verbose',
			workspace_folders=[
				lsp_types.WorkspaceFolder(uri=root_uri, name=os.path.basename(root_path))
			]
		)

		params = self.convert_unstructure(params)

		future = self.request(lsp_types.INITIALIZE, params)
		# future.add_done_callback(self.handle_initialize_response)
		return self.handle_initialize_response(future)
	
	def send_did_open_doc(self, file_path):
		file_path = (root_path / Path(file_path))

		language_id = LanguageRegistry.language_for_file(file_path.as_posix())

		params = lsp_types.DidOpenTextDocumentParams(
			text_document=lsp_types.TextDocumentItem(
				uri=file_path.as_uri(),
				language_id=language_id,
				text=file_path.read_text(),
				version=0
			)
		)

		params = self.convert_unstructure(params)

		self.notify(lsp_types.TEXT_DOCUMENT_DID_OPEN, params)


class AbstractLSPServer:
	def start():
		pass

	def stop():
		pass

	def get_streams(self) -> tuple[JsonRpcStreamReader, JsonRpcStreamWriter]:
		pass

class LSPConnector(threading.Thread):
	lsp_dispatcher: LSPClientDispatcher
	endpoint: Endpoint
	lsp_server: AbstractLSPServer

	def __init__(self, lsp_dispatcher: LSPClientDispatcher, lsp_server: AbstractLSPServer, group = None, target = None, name = None, args = ..., kwargs = None, *, daemon = None):
		super().__init__(group, target, name, args, kwargs, daemon=daemon)

		self.lsp_server = lsp_server
		self.lsp_dispatcher = lsp_dispatcher
		self.reader, self.writer = lsp_server.get_streams()
		self.endpoint = Endpoint(lsp_dispatcher, self.writer.write)

	def route_rx_message(self, msg):
		# notify
		if 'method' in msg:
			try:
				if self.lsp_dispatcher[msg['method']]:
					self.endpoint.consume(msg)
			except KeyError:
				self.lsp_dispatcher.handle_no_response(msg['method'], msg['params'])

		# response
		elif msg.get('id', None):
			self.endpoint.consume(msg)

	def run(self):
		self.reader.listen(self.route_rx_message)

	def shutdown(self):
		self.endpoint.shutdown()
		self.lsp_server.stop()


class LSPServerPython(AbstractLSPServer):
	reader: JsonRpcStreamReader
	writer: JsonRpcStreamWriter
	exts = ['py']

	def __init__(self, root_path):
		super().__init__()

		self.root_path = root_path

	def start(self):
		self.server_proc = subprocess.Popen(
			self.get_cmd_args(),
			stdin=subprocess.PIPE,
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			bufsize=0
		)

		self.reader = JsonRpcStreamReader(self.server_proc.stdout)
		self.writer = JsonRpcStreamWriter(self.server_proc.stdin, sort_keys=True)

	def stop(self):
		self.server_proc.kill()

	def get_streams(self):
		return (self.reader, self.writer)
	
	def is_started(self):
		return True
	
	def get_exts(self):
		return self.exts
	
	def get_cmd_args(self):
		return ['pyright-langserver', '--stdio']


class LSPServerRunner:
	@classmethod
	def create(cls_name, root_path, language_id):
		if language_id == 'python':
			return LSPServerPython(root_path)
		elif language_id == 'typescript':
			pass
		elif language_id in ['cpp', 'c']:
			pass
		else:
			raise NotSupportedLanguageServer(f'{language_id} is not supported language server yet')


class LSPClient:
	lsp_dispatcher: LSPClientDispatcher
	
	def __init__(self, lsp_dispatcher: LSPClientDispatcher):
		self.lsp_dispatcher = lsp_dispatcher
		# self.doc_event_handler = doc_event_handler

	def initialize(self, root_path):
		return self.lsp_dispatcher.send_initialize(root_path)
	
	# def get_definition(self, file_path, line, column):
	# 	return self.lsp_dispatcher.send_definition(file_path, line, column)
	



def main():
	lsp_server = LSPServerRunner.create(root_path, language_id)
	lsp_server.start()

	lsp_dispatcher = LSPClientDispatcher()
	lsp_connector = LSPConnector(lsp_dispatcher, lsp_server)
	lsp_connector.start()

	lsp_dispatcher.set_endpoint(lsp_connector.endpoint)

	# watcher = ...
	lsp_client = LSPClient(lsp_dispatcher)

	lsp_client.initialize(root_path)

	try:
		lsp_connector.join()
	except KeyboardInterrupt:
		lsp_connector.shutdown()


if __name__ == '__main__':
	main()