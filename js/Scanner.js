class Scanner {
    constructor() {
        this.element = $("#scanner")
        this.chunks = {}
        this.video = document.createElement("video")
        this.canvas = document.createElement("canvas")
        this.ctx = this.canvas.getContext("2d")
        this.stream = null
        this.scanning = false
		this.bindEvents()
    }
    
    bindEvents() {
        const ref = this
        
        $("#start-scanner").click(function() {
            ref.startScanner()
        })
        
        $("#stop-scanner").click(function() {
            ref.stopScanner()
        })
        
        $("#add-manual").click(function() {
            const text = $("#manual-input textarea").val().trim()
            if (text) {
                ref.processChunk(text)
                $("#manual-input textarea").val("")
            }
        })
        
        $("#copy-data").click(function() {
            const data = $("#reconstructed-data pre").text()
            ClipboardJS.copy(data)
        })
        
        $("#download-data").click(function() {
            const data = $("#reconstructed-data pre").text()
            const blob = new Blob([data], { type: "text/plain" })
            saveAs(blob, "reconstructed-data.txt")
        })
    }
    
    async startScanner() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            })
            
            this.video = $("#scanner-video")[0]
            this.video.srcObject = this.stream
            this.video.setAttribute("playsinline", true)
            
            await this.video.play()
            
            $("#start-scanner").hide()
            $("#stop-scanner").show()
            
            this.scanning = true
            this.scanFrame()
            
        } catch (err) {
            console.error("Error starting scanner:", err)
            alert("Error accessing camera: " + err.message)
        }
    }
    
    stopScanner() {
        this.scanning = false
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.stream = null
        }
        
        $("#start-scanner").show()
        $("#stop-scanner").hide()
    }
    
    scanFrame() {
        if (!this.scanning) return
        
        try {
            if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                this.canvas.width = this.video.videoWidth
                this.canvas.height = this.video.videoHeight
                
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
                
                const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                })
                
                if (code) {
                    this.processChunk(code.data)
                }
            }
        } catch (err) {
            console.error("Scan error:", err)
        }
        
        if (this.scanning) {
            requestAnimationFrame(() => this.scanFrame())
        }
    }
    
    processChunk(data) {
        try {
            // Parse the chunk data format: "id index total datatype filename\ndata"
            const lines = data.split('\n')
            const header = lines[0].split(' ')
            const body = lines.slice(1).join('\n')
            
            if (header.length < 3) {
                throw new Error("Invalid chunk format")
            }
            
            const [id, index, total, datatype = "", filename = ""] = header
            
            if (!this.chunks[id]) {
                this.chunks[id] = {
                    total: parseInt(total),
                    chunks: new Array(parseInt(total)),
                    datatype: datatype,
                    filename: filename === "_" ? "" : atob(filename),
                    received: 0
                }
            }
            
            // Store the chunk
            if (!this.chunks[id].chunks[parseInt(index)]) {
                this.chunks[id].chunks[parseInt(index)] = body
                this.chunks[id].received++
            }
            
            this.updateProgress(id)
            
            // Check if all chunks are received
            if (this.chunks[id].received === this.chunks[id].total) {
                this.reconstructData(id)
            }
            
        } catch (err) {
            console.error("Error processing chunk:", err)
            alert("Error processing QR code: " + err.message)
        }
    }
    
    updateProgress(id) {
        const chunkInfo = this.chunks[id]
        const progressHtml = Object.keys(this.chunks).map(chunkId => {
            const info = this.chunks[chunkId]
            return `
                <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <strong>ID: ${chunkId}</strong><br>
                    Progress: ${info.received}/${info.total} chunks<br>
                    Type: ${info.datatype || "raw"}<br>
                    ${info.filename ? `File: ${info.filename}<br>` : ""}
                    <progress value="${info.received}" max="${info.total}" style="width: 100%;"></progress>
                </div>
            `
        }).join("")
        
        $("#chunks-list").html(progressHtml)
    }
    
    reconstructData(id) {
        const chunkInfo = this.chunks[id]
        const fullData = chunkInfo.chunks.join("")
        
        $("#reconstructed-data").show()
        $("#reconstructed-data pre").text(fullData)
        
        // Show success message
        alert(`Successfully reconstructed data from ${chunkInfo.total} chunks!`)
        
        // Optionally auto-stop scanner
        this.stopScanner()
    }
    
    hide() {
        this.stopScanner()
        this.element.hide()
    }
    
    show() {
        this.element.show()
        this.chunks = {}
        $("#chunks-list").empty()
        $("#reconstructed-data").hide()
    }
}