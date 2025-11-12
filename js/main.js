let _new = new New()
let _home = new Home()
let _scanner = new Scanner()  // Add this line

const router = new Router({
    mode: 'history',
    page404: function (data) {
		_home.hide()
		_new.hide()
		_decrypter.show()
		_decrypter.update(data, window.location.search)
	}
})

router.add(`new`, function (data) {
	_home.hide()
	_new.show()
	_scanner.hide()  // Add this
})

router.add(`/`, function (data) {
	_home.show()
	_new.hide()
	_scanner.hide()  // Add this
})

// Add scanner route
router.add(`scanner`, function (data) {
	_home.hide()
	_new.hide()
	_scanner.show()
})

router.addUriListener()

window.onload = function(){
	router.navigateTo(window.location.pathname + window.location.search)
}