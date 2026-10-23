// JS Worker comparison only; production uses Rust/WASM in scripture-import-worker.
import {parentPort} from 'node:worker_threads';
import {readNotionZip,notionBibleVerses} from '../server/notion-scripture-import.js';
parentPort.once('message',bytes=>parentPort.postMessage(notionBibleVerses(readNotionZip(Buffer.from(bytes)))));
