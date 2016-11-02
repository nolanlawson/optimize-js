// a browserify-style function call that has non-numeric object indices shouldn't
// be optimized.
!(function(o){
  return o[0]();
})(
  {
    a:[
      function(o,r,t){
        console.log("browserify style!");
      },
      {}
    ]
  }
);
