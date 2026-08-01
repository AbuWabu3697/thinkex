export interface ZipEntryInput {
	data?: ArrayBuffer | Uint8Array | string;
	modifiedAt?: Date;
	path: string;
}

interface PreparedZipEntry {
	crc32: number;
	data: Uint8Array;
	localHeaderOffset: number;
	modifiedAt: Date;
	path: string;
}

const textEncoder = new TextEncoder();
const crcTable = createCrc32Table();

export function createZipArchive(entries: ZipEntryInput[]): Uint8Array {
	const preparedEntries: PreparedZipEntry[] = [];
	const chunks: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const path = normalizeZipEntryPath(entry.path);
		if (!path) {
			continue;
		}

		const data = path.endsWith("/") ? new Uint8Array() : toBytes(entry.data ?? "");
		const prepared: PreparedZipEntry = {
			crc32: crc32(data),
			data,
			localHeaderOffset: offset,
			modifiedAt: entry.modifiedAt ?? new Date(),
			path,
		};
		const localHeader = createLocalFileHeader(prepared);
		chunks.push(localHeader, data);
		offset += localHeader.byteLength + data.byteLength;
		preparedEntries.push(prepared);
	}

	const centralDirectoryOffset = offset;
	const centralDirectory = preparedEntries.map(createCentralDirectoryHeader);
	for (const chunk of centralDirectory) {
		chunks.push(chunk);
		offset += chunk.byteLength;
	}

	const centralDirectorySize = offset - centralDirectoryOffset;
	chunks.push(
		createEndOfCentralDirectory({
			centralDirectoryOffset,
			centralDirectorySize,
			entryCount: preparedEntries.length,
		}),
	);

	return concatBytes(chunks);
}

function createLocalFileHeader(entry: PreparedZipEntry) {
	const name = textEncoder.encode(entry.path);
	const output = new Uint8Array(30 + name.byteLength);
	const view = new DataView(output.buffer);
	const dosTime = getDosDateTime(entry.modifiedAt);

	view.setUint32(0, 0x04034b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(6, 0x0800, true);
	view.setUint16(8, 0, true);
	view.setUint16(10, dosTime.time, true);
	view.setUint16(12, dosTime.date, true);
	view.setUint32(14, entry.crc32, true);
	view.setUint32(18, entry.data.byteLength, true);
	view.setUint32(22, entry.data.byteLength, true);
	view.setUint16(26, name.byteLength, true);
	output.set(name, 30);

	return output;
}

function createCentralDirectoryHeader(entry: PreparedZipEntry) {
	const name = textEncoder.encode(entry.path);
	const output = new Uint8Array(46 + name.byteLength);
	const view = new DataView(output.buffer);
	const dosTime = getDosDateTime(entry.modifiedAt);
	const isDirectory = entry.path.endsWith("/");

	view.setUint32(0, 0x02014b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(6, 20, true);
	view.setUint16(8, 0x0800, true);
	view.setUint16(10, 0, true);
	view.setUint16(12, dosTime.time, true);
	view.setUint16(14, dosTime.date, true);
	view.setUint32(16, entry.crc32, true);
	view.setUint32(20, entry.data.byteLength, true);
	view.setUint32(24, entry.data.byteLength, true);
	view.setUint16(28, name.byteLength, true);
	view.setUint32(38, isDirectory ? 0x10 : 0, true);
	view.setUint32(42, entry.localHeaderOffset, true);
	output.set(name, 46);

	return output;
}

function createEndOfCentralDirectory(input: {
	centralDirectoryOffset: number;
	centralDirectorySize: number;
	entryCount: number;
}) {
	const output = new Uint8Array(22);
	const view = new DataView(output.buffer);

	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, input.entryCount, true);
	view.setUint16(10, input.entryCount, true);
	view.setUint32(12, input.centralDirectorySize, true);
	view.setUint32(16, input.centralDirectoryOffset, true);

	return output;
}

function toBytes(data: ArrayBuffer | Uint8Array | string) {
	if (typeof data === "string") {
		return textEncoder.encode(data);
	}

	return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function concatBytes(chunks: Uint8Array[]) {
	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const output = new Uint8Array(total);
	let offset = 0;

	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return output;
}

function normalizeZipEntryPath(path: string) {
	const isDirectory = path.endsWith("/");
	const normalized = path
		.split("/")
		.filter((segment) => segment && segment !== "." && segment !== "..")
		.join("/");

	return normalized && isDirectory ? `${normalized}/` : normalized;
}

function getDosDateTime(date: Date) {
	const year = Math.max(1980, date.getFullYear());

	return {
		date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
		time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
	};
}

function crc32(data: Uint8Array) {
	let crc = 0xffffffff;

	for (const byte of data) {
		crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
	}

	return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
	const table: number[] = [];

	for (let index = 0; index < 256; index += 1) {
		let crc = index;

		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
		}

		table[index] = crc >>> 0;
	}

	return table;
}
