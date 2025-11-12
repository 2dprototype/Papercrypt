function formatTS(t) {
	const date = new Date(t)
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = date.getFullYear();
	let hours = date.getHours();
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const period = hours >= 12 ? 'PM' : 'AM';
	
	// Convert hours to 12-hour format
	if (hours > 12) {
		hours -= 12;
		} else if (hours === 0) {
		hours = 12;
	}
	
	return `${day}/${month}/${year} ${hours}:${minutes} ${period}`;
}

function formatNumber(num) {
    if (num < 1000) {
        return num.toString(); // No formatting needed for numbers less than 1000
	} 
	else if (num < 1000000) {
        // Convert to K format (e.g., 1.1K, 100K)
        return (num / 1000).toFixed(1) + "K";
	} 
	else if (num < 1000000000) {
        // Convert to M format (e.g., 1M, 10.5M)
        return (num / 1000000).toFixed(1) + "M";
	} 
	else {
        // Convert to B format (e.g., 1.2B)
        return (num / 1000000000).toFixed(1) + "B";
	}
}	

function randomString(length) {
    let result = '';
	var characters ='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	
    return result;
}

function hashWithinRange(lat, lon, rangeMeters = 100) {
	const precision = rangeMeters / 111000;
	const roundedLat = Math.floor(lat / precision) * precision;
	const roundedLon = Math.floor(lon / precision) * precision;
	const str = `${roundedLat.toFixed(6)},${roundedLon.toFixed(6)}`

	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i)
	}

	return (hash >>> 0).toString(16)
}