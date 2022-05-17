function encrypt(data, _key){
	if(_key == undefined){
			console.error('key is not defined')
		return 
	}
	else if(_key.length == 0){
		return data
	}
	
	var key = make_key(data, _key);
	var result = '';
	
	
	for(i = 0; i < data.length; i++){
		var _char = data[i];
		var g = '';
		for(j = 0; j < key.length; j++){
			var _k = parseInt(key[j]);
			if(i == j) g += String.fromCharCode(_char.charCodeAt([0]) + _k);
		}
		result += g
	}
	
	
	return result

}
function decrypt(data, _key){
	
	if(_key == undefined){
			console.error('key is not defined')
		return 
	}
	else if(_key.length == 0){
		return data
	}
	
	var key = make_key(data, _key);
	var result = '';
	
	
	for(i = 0; i < data.length; i++){
		var _char = data[i];
		var g = '';
		for(j = 0; j < key.length; j++){
			var _k = parseInt(key[j]);
			if(i == j) g += String.fromCharCode(_char.charCodeAt([0]) - _k);
		}
		result += g
	}
	
	
	return result

}

function make_key(data, key){
	var array = [];
	var text = '';
	var d = data.length;
	var k = key.length;
	
	if(d < k){
		console.error('key must be less than data (data > key)')
		return 
	}
	
	for(i = 0; i < parseInt(d/k) + 1; i++){
		// if the i is even	
		if(i % 2 == 0) {
			text += reverseString(key)
		}
		// if the i is odd
		else {
			text += key
		}
	}
	var text_2 = text.slice(0, data.length);
	
	for(i = 0; i < data.length; i++){
		var _m = reverseString(`${ text_2[i].charCodeAt([0]) }`)
		array.push(parseInt(_m))
	}

	return array
}

function reverseString(str) {
    return str.split("").reverse().join("");
}