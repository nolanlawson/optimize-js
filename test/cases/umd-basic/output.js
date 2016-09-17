(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global.MyModule = factory());
}(this, (function () { 'use strict';

  var index = console.log('yolo')

  return index;

})));