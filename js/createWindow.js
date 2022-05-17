function createWindow(json_data){
	
	this.qr_imgData = [];
	
	this.create_window = document.getElementById('create_window');
	this.element_id = document.getElementById('text-id');
	this.element_maxLength = document.getElementById('number-maxLength');
	this.element_password = document.getElementById('text-password');
	this.element_upload = document.getElementById('upload-file');
	this.element_qr_body = document.getElementById('qr-body');
	this.element_data = document.getElementById('text-data');
	this.element_enable_b64 = document.getElementById('enable-b64');
	this.element_info = document.getElementById('create-info');
	this.element_correctLevel = document.getElementById('select-correctLevel');
	
	this.qr_qtz = document.getElementById('qr_qtz');
	this.qr_qtz_col = document.getElementById('qr_qtz_col');
	
	this.qr_enable_logo = document.getElementById('qr_enable_logo');
	this.qr_enable_logo_t = document.getElementById('qr_enable_logo_t');
	
	this.qr_fileType = document.getElementById('qr_fileType');
	this.qr_fileName = document.getElementById('qr_fileName');
	
	this.qr_width = document.getElementById('qr_width');
	this.qr_height = document.getElementById('qr_height');
	this.qr_bg = document.getElementById('qr_bg');
	this.qr_fg = document.getElementById('qr_fg');
	
	this.qr_generate = document.getElementById('qr-generate');
	this.qr_download = document.getElementById('qr-download');
	
	this.json_data = json_data;
}

createWindow.prototype.update_info = function(){
	var num = parseInt( parseInt(this.element_data.value.length) / parseInt(this.element_maxLength.value) ) + 1;
	
	this.element_info.innerText = `Total generated QR Codes will ${num}`;
}

createWindow.prototype.hide = function(){
	this.create_window.style.display = 'none';
}

createWindow.prototype.show = function(){
	this.create_window.style.display = 'block';
}

createWindow.prototype.download = function(serial){
	var ref = this;
	var arr = [];

	for(i = 0; i < this.qr_imgData.length; i++){
		var qrcode = this.qr_imgData[i];
		if(qrcode._oDrawing._bIsPainted){
			var data = qrcode._oDrawing.dataURL;
			var b64_data = data.slice(data.substring(data.lastIndexOf("data"), data.lastIndexOf("base64,") + 'base64,'.length).length, data.length);
			arr.push( b64_data );
		}
	}
	
	
	var text = (function (){
		var str = '';
		
		for(i = 0; i < ref.qr_imgData.length; i++){
			str += `images/${serial}_${i}.png \n`;
		}
		
		return str
	})();

	var zip = new JSZip();
	zip.file("list.txt", text);
	var images = zip.folder("images");
	for(i = 0; i < arr.length; i++){
		var imgData = arr[i];
		images.file(`${serial}_${i}.png`, imgData, {base64: true});
	}
	zip.generateAsync({type:"blob"}).then(function(content) {
		saveAs(content, `QR_Paper_Store_${serial}.zip`);
	});
}

createWindow.prototype.init_setup = function(){
	var ref = this;
	ref.element_upload.addEventListener('change', (e) => {
		if(e.target.files[0].name){
			var reader =  new FileReader();
			var file = e.target.files[0]
			reader.readAsDataURL(file);
			reader.onload =  function(e){
				var data = e.target.result;
				ref.element_data.value = data.slice(data.substring(data.lastIndexOf("data"), data.lastIndexOf("base64,") + 'base64,'.length).length, data.length);
				ref.qr_fileName.value = file.name;
				ref.qr_fileType.value = 1;
			}
		}
		ref.update_info();
	});
	
	ref.element_data.onchange = function(){
		ref.update_info();
	}
	ref.element_data.onkeydown = function(){
		ref.update_info();
	}
	ref.element_data.onkeyup = function(){
		ref.update_info();
	}
	ref.qr_generate.onclick = function(){
		ref.generate();
	};
	ref.qr_download.onclick = function(){
		ref.download(ref.element_id.value);
	};
}

createWindow.prototype.init = function(){
	this.element_id.value = randomString(5);
	this.element_maxLength.value = 255 * 2;
	this.element_password.value = '';
	
	this.qr_qtz.value = 5;
	
	this.qr_width.value = 255;
	this.qr_height.value = 255;
	this.qr_bg.value= '#ffffff';
	this.qr_fg.value = '#3b3f54';
	this.qr_qtz_col.value = '#18D100';
}

createWindow.prototype.clear = function(){
	this.element_id.value = '';
	this.element_maxLength.value = '';
	this.element_password.value = '';
}

createWindow.prototype.makeImage = function(index, serial, size = 100, col = "#000"){
    var canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	
	var ctx = canvas.getContext('2d');
	
	ctx.translate(size / 2, size / 2);
	ctx.textAlign = "center";
	ctx.font = `${size / 1.2}px Arial`;
	ctx.fillStyle = col;
	ctx.fillText(index, 0, size / 4);
	if(serial.length > 10) ctx.font = `${size / serial.length}px Arial`;
	else ctx.font = `${size/10}px Arial`;
	ctx.fillText(serial, 0, size / 2.5);
	
    var dataURL = canvas.toDataURL();

	return dataURL
}

createWindow.prototype.generate = function(){
	this.qr_imgData = [];
	this.element_qr_body.innerHTML = '';
	
	var id = this.element_id.value;
	var maxLength = parseInt(this.element_maxLength.value);
	var data = this.element_data.value;
	var key = this.element_password.value;
	
	var correctLevel = parseInt(this.element_correctLevel.value);
	
	var qr_qtz = parseInt(this.qr_qtz.value);
	var qr_qtz_col = this.qr_qtz_col.value;
	
	
	var qr_width = parseInt(this.qr_width.value);
	var qr_height = parseInt(this.qr_height.value);
	var qr_bg = this.qr_bg.value;
	var qr_fg = this.qr_fg.value;
	
	var qr_fileName = this.qr_fileName.value;
	var qr_fileType = this.qr_fileType.value;
	
	var qr_enable_logo = this.qr_enable_logo.checked;
	var qr_enable_logo_t = this.qr_enable_logo_t.checked;
	
	var e_text = encrypt(data, key);
	
	var x_text = '';
	
	if(this.element_enable_b64.checked) x_text = Base64.encode(e_text);
	else x_text = e_text;
	
	var length = parseInt( parseInt(this.element_data.value.length) / parseInt(this.element_maxLength.value) );
	
	var x_data = this.json_data.packData(length, qr_fileName, qr_fileType, Number(this.element_enable_b64.checked), x_text);
	var arr = this.json_data.sliceData(x_data, maxLength, id);
	
	// console.log(arr[0])
	// console.log(json_data.joinData( arr ));
	for(i = 0; i < arr.length; i++){
		var img = null;
		
		if(qr_enable_logo) img = this.makeImage(i, id, (qr_width + qr_height) / 2, qr_fg);
		else img = null;
			
		var options = {
			text: arr[i],
			width: qr_width,
			height: qr_height, 
			colorDark: qr_fg,
			colorLight: qr_bg,
			quietZone: qr_qtz,
			quietZoneColor: qr_qtz_col,
			logo: img, 
			logoBackgroundColor: qr_bg,
			logoBackgroundTransparent: qr_enable_logo_t, 
			correctLevel: correctLevel // L, M, Q, H
		}
		var qrcode = new QRCode(this.element_qr_body, options);
		this.qr_imgData.push(qrcode);
	}
}