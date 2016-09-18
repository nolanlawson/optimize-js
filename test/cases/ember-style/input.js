(function (e, t) {
  "use strict";
  "object" == typeof module && "object" == typeof module.exports ? module.exports = e.document ? t(e, !0) : function (e) {
    if (!e.document)throw new Error("jQuery requires a window with a document");
    return t(e)
  } : t(e)
})(true), function () {
  console.log('optimize me!');
}();