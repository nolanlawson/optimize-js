// a browserify-style object literal that isn't a parameter shouldn't be optimized.
var a = {
  1:[
    function(o,r,t){
      console.log("browserify style!");
    },
    {}
  ]
};
