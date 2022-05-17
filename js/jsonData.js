var jsonData = function(){
	
}

jsonData.prototype.packData = function(length, name, type, encoding, data){
	var obj = {
		l : length,
		n : name,
		t : type,
		e : encoding,
		d : data
	}
	
	return JSON.stringify(obj);
}

jsonData.prototype.joinData = function(array){
	var str = ''
	for(i = 0; i < array.length; i++){
		str += JSON.parse(array[i]).d;
	}
	
	return str

}

jsonData.prototype.sliceData = function(data, maxLength, serial){
	console.log(data.length)
	var len = data.length;
	var to_i = parseInt(len / maxLength);
	var arr = [];
	
	for(i = 0; i < to_i + 1; i++){
		var d = data.slice(i * maxLength, (i + 1) * maxLength);
		arr.push(this.writeJSON(d, serial, i));
	}
	
	return arr
}

jsonData.prototype.writeJSON = function(data, serial, i){
	var obj = {
		i : i,
		s : serial,
		d : data
	}
	
	
	return JSON.stringify(obj)
}