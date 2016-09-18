function doIt(fun) {
  fun()
}
doIt(2, function () {
  console.log('heya')
}, 4)