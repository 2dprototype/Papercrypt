function App(){
	
	this.json_data = new jsonData();
	this.create_window = new createWindow(this.json_data);
	this.show_createWindow_button = document.getElementById('show_createWindow_button');
	this.show_scanWindow_button = document.getElementById('show_scanWindow_button');

}

App.prototype.init = function(){
	var ref = this;
	this.create_window.init();
	this.create_window.init_setup();
	
	this.show_createWindow_button.onclick = function(){
		ref.show_createWindow();
	}
	this.show_scanWindow_button.onclick = function(){
		ref.show_scanWindow();
	}
}

App.prototype.show_createWindow = function(){
	this.create_window.show();
}

App.prototype.show_scanWindow = function(){
	this.create_window.hide();
}