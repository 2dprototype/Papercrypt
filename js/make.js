function revMap(map){
	let _map = {}
	for (k in map) {
		let v = map[k]
		_map[v] = k
	}
	return _map
}


const dataTypeMap = {
	"raw":         "0",
	"redirect":    "1",
	"account":     "2",
	"download":    "3",
	"file":        "4"
}
const dataTypeMap_ = revMap(dataTypeMap)
const encodingMap = {
	"Base64url":    "0",
	"Base64":       "1",
	"Hex":          "2"
}
const encodingMap_ = revMap(encodingMap)



function encrypt(v, k){
	return CryptoJS.AES.encrypt(v, k).toString().replaceAll("/", "_").replaceAll("+", "-").replaceAll("=", "")
}

function decrypt(v, k){
	v = v.replaceAll("_", "/").replaceAll("-", "+")
	return CryptoJS.AES.decrypt(v, k).toString(CryptoJS.enc.Utf8)
}

function chunkString(str, size) {
	if (typeof str !== "string" || size <= 0) return []
	const chunks = [];
	for (let i = 0; i < str.length; i += size) {
		chunks.push(str.slice(i, i + size))
	}
	return chunks
}

function make(data, size, encoding, datatype, id, filename) {
	if (filename == "") filename = "_"
	else filename = btoa(filename)
	
	let arr = []
	
	let chunks = chunkString(data, size)
	for (let i in chunks) {
		let chunk = chunks[i]
		let header = ""
		if (i == 0) header = [id, i, chunks.length, datatype, filename].join(" ")
		else header = [id, i, chunks.length, "", ""].join(" ")
		let body = chunk
		let str = `${header}\n${body}`
		arr.push(str)
	}

	return arr
}

function parseQuery(str){
	if (str[0] == "?") str = str.slice(1)
	let obj = {
		scanType: null,
		encoding: null,
		keyType: null
	}
	for (let i in str) {
		let v = str[i]
		if (i == 0) obj.scanType = v
		else if (i == 1) obj.encoding = v
		else if (i == 2) obj.keyType = v
	}
	return obj
}

function makeLog(...args) {
	var str = ""
	for(a of args) str += `${a[0]}: ${a[1]}\n`
	return str.trim()
}

function hideKey(str) {
	let out = ""
	for (s of str) out += "*"
	return out
}