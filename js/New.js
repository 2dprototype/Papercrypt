const icons = [
	"facebook",
	"google",
	"instagram",
	"messenger",
	"twitter",
	"whatsapp",
	"yahoo",
	"gmail",
	"hellocat",
	"reddit",
	"x",
	"youtube",
	"link",
	"website"
]

class New {
	constructor() {
		var ref = this
		this.element = $("#new")
		this.inputs = this.element.find("input")
		this.buttons = this.element.find("button")
		this.selects = this.element.find("select")
		this.canvases = this.element.find("canvas")
		this.textareas = this.element.find("textarea")
		this.codes = this.element.find("code")
		this.iconPicker = this.element.find("#icon-picker")
		this.currentDatas = [] // Store all chunk data
		this.currentConfig = {} // Store current configuration
		
		$(this.inputs[0]).val(randomString(6))
		$(this.buttons[0]).click(function(){
			var input = document.createElement('input')
			input.type = 'file'
			input.click();
			input.addEventListener('change', function (e) {
				if (e.target.files[0].name) {
					let file = e.target.files[0]
					var reader = new FileReader();
					reader.readAsDataURL(e.target.files[0])
					reader.onload = function (f) {
						ref.textareas[0].value = f.target.result
						ref.inputs[1].value = file.name
					}
				}
			})
		})
		
		for (let icon of icons) {
			let im = new Image()
			im.setAttribute("class", "xicon")
			im.src = `/res/icons/${icon}.png`
			im.height = 32
			im.width = 32
			$(im).click(function(){
				$(".xicon").css("background-color", "transparent")
				this.style.backgroundColor = "#ebebeb"
				ref.imgData = this.src
				let txt = icon[0].toUpperCase() + icon.slice(1)
				ref.inputs[3].value = txt
			})
            this.iconPicker.append(im);
		}
		
		this.imgData = null
		$(this.inputs[8]).click(function(){
			var input = document.createElement('input')
			input.type = 'file'
			input.setAttribute('accept', "image/*")
			input.click();
			input.addEventListener('change', function (e) {
				if (e.target.files[0].name) {
					let file = e.target.files[0]
					var reader = new FileReader();
					reader.readAsDataURL(e.target.files[0])
					ref.img_name = e.target.files[0].name
					reader.onload = function (f) {
						let im = new Image()
						im.setAttribute("class", "xicon")
						im.src = f.target.result
						im.height = 32
						im.width = 32
						$(im).click(function(){
							$(".xicon").css("background-color", "transparent")
							this.style.backgroundColor = "#ebebeb"
							ref.imgData = this.src
						})
						ref.iconPicker.append(im);
					}
				}
			})
		})
		
		$(this.buttons[1]).click(function(){
			ref.generate()
		})	
		
		$(this.buttons[2]).click(function(){
			ClipboardJS.copy(ref.codes[0].innerText)
		})	
		// Add download all button event
		$(this.buttons[3]).click(function(){
			ref.downloadAllChunks()
		})
	}
	
	hide() {
		this.element.hide()
	}
	
	show() {
		this.element.show()
	}
	
	generate(){
		try {
			let canvas = this.canvases[0]
			$(canvas).show()
			$(this.buttons[2]).show()
			$(this.buttons[3]).show()
			$(this.buttons[4]).show() // Show download all button
			
			var _data = this.textareas[0].value
			var datatype = this.selects[1].value
			var encoding = this.selects[0].value
			var id = this.inputs[0].value
			var filename = this.inputs[1].value
			var packetSize = parseInt(this.inputs[2].value)
			var datas = make(_data, packetSize, encoding, datatype, id, filename)
			
			// Store current data and config for download all functionality
			this.currentDatas = datas
			this.currentConfig = {
				label: this.inputs[3].value,
				labelSize: parseFloat(this.inputs[4].value),
				labelColor: this.inputs[5].value,
				labelX: parseFloat(this.inputs[6].value),
				labelY: parseFloat(this.inputs[7].value),
				bg: this.inputs[9].value,
				qrbg: this.inputs[10].value,
				qrfg: this.inputs[11].value,
				correctLevel: this.selects[2].value,
				imgData: this.imgData
			}

			if (datas.length == 1) {
				this.codes[0].innerText = `Your data requires only 1 QR Code.`
			} else {
				this.codes[0].innerText = `Your data requires ${datas.length} QR Codes. Below is the preview of initial packet. You can also download all QR Codes as zip.`
			}
			
			var context = this.canvases[0].getContext("2d")
			var label = this.inputs[3].value
			var labelSize = parseFloat(this.inputs[4].value)
			var labelColor = this.inputs[5].value
			var labelX = parseFloat(this.inputs[6].value)
			var labelY = parseFloat(this.inputs[7].value)
			
			var bg = this.inputs[9].value
			var qrbg = this.inputs[10].value
			var qrfg = this.inputs[11].value
			var correctLevel = this.selects[2].value

			this.codes[1].innerText = makeLog(
				["datatype", datatype],
				["label", label],
				["labelColor", labelColor],
				["labelXY", `(${labelX}, ${labelY})`],
				["background", bg],
				["qrBackground", qrbg],
				["qrForeground", qrfg],
				["correctLevel", correctLevel],
				["Packets", datas.length],
			)

			var qrcode = new QRCode(document.createElement("div"), {
				text: datas[0],
				width: 500,
				height: 500,
				colorDark : qrfg,
				colorLight : qrbg,
				correctLevel : QRCode.CorrectLevel[correctLevel]
			})	
			
			context.reset()
			context.fillStyle = bg;
			context.fillRect(0, 0, canvas.width, canvas.height)
			var qrCanvas = qrcode._oDrawing._elCanvas;
			context.drawImage(qrCanvas, 0, 0);

			if (this.imgData != null) {
				let im = new Image()
				im.src = this.imgData
				im.onload = function() {
					context.drawImage(im, 10, 510, 80, 80);
				}
			}

			// Draw additional content on top of the QR code
			context.fillStyle = labelColor;
			context.font = labelSize + "px Arial";
			context.fillText(label, 115  + labelX, 550 + labelSize/3 + labelY);
		}
		catch(err) {
			alert(err)
		}
	}

	downloadAllChunks() {
		if (this.currentDatas.length === 0) {
			alert("Please generate QR codes first!")
			return
		}

		const ref = this
		const zip = new JSZip()
		const folder = zip.folder("qrcode-chunks")
		
		// Show loading indicator
		const loadingText = this.codes[0].innerText
		this.codes[0].innerText = "Generating ZIP file with all QR codes... Please wait."
		
		// Create a temporary canvas for generating QR codes
		const tempCanvas = document.createElement('canvas')
		tempCanvas.width = 500
		tempCanvas.height = 600
		const tempCtx = tempCanvas.getContext('2d')
		
		let completed = 0
		const total = this.currentDatas.length
		
		this.currentDatas.forEach((data, index) => {
			try {
				// Generate QR code for this chunk
				const qrcode = new QRCode(document.createElement("div"), {
					text: data,
					width: 500,
					height: 500,
					colorDark: this.currentConfig.qrfg,
					colorLight: this.currentConfig.qrbg,
					correctLevel: QRCode.CorrectLevel[this.currentConfig.correctLevel]
				})
				
				// Draw on temporary canvas
				tempCtx.reset()
				tempCtx.fillStyle = this.currentConfig.bg
				tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
				
				const qrCanvas = qrcode._oDrawing._elCanvas
				tempCtx.drawImage(qrCanvas, 0, 0)
				
				// Draw icon if available
				if (this.currentConfig.imgData) {
					const img = new Image()
					img.src = this.currentConfig.imgData
					img.onload = function() {
						tempCtx.drawImage(img, 10, 510, 80, 80)
						drawLabel()
					}
				} else {
					drawLabel()
				}
				
				function drawLabel() {
					// Draw label
					tempCtx.fillStyle = ref.currentConfig.labelColor
					tempCtx.font = ref.currentConfig.labelSize + "px Arial"
					// const labelText = `${ref.currentConfig.label}-${index + 1}`
					const labelText = ref.currentConfig.label.replaceAll("#index", index)
					tempCtx.fillText(
						labelText, 
						115 + ref.currentConfig.labelX, 
						550 + ref.currentConfig.labelSize/3 + ref.currentConfig.labelY
					)
					
					// Convert canvas to blob and add to zip
					tempCanvas.toBlob(function(blob) {
						folder.file(`chunk-${index + 1}.png`, blob)
						completed++
						
						// Update progress
						ref.codes[0].innerText = `Generating ZIP file... ${completed}/${total} QR codes created.`
						
						// When all chunks are processed, generate and download zip
						if (completed === total) {
							zip.generateAsync({type: "blob"}).then(function(content) {
								saveAs(content, `qrcode-chunks-${ref.inputs[0].value}.zip`)
								ref.codes[0].innerText = `Successfully downloaded ${total} QR codes as ZIP file!`
							}).catch(function(err) {
								console.error("Error generating ZIP:", err)
								alert("Error generating ZIP file: " + err.message)
								ref.codes[0].innerText = loadingText
							})
						}
					}, "image/png")
				}
				
			} catch (err) {
				console.error(`Error generating QR code for chunk ${index}:`, err)
				completed++
				if (completed === total) {
					ref.codes[0].innerText = loadingText
					alert("Some QR codes failed to generate. Please try again.")
				}
			}
		})
	}	
}