"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+bbox@7.3.3";
exports.ids = ["vendor-chunks/@turf+bbox@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+bbox@7.3.3/node_modules/@turf/bbox/dist/esm/index.js":
/*!***************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+bbox@7.3.3/node_modules/@turf/bbox/dist/esm/index.js ***!
  \***************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   bbox: () => (/* binding */ bbox),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n// index.ts\n\nfunction bbox(geojson, options = {}) {\n  if (geojson.bbox != null && true !== options.recompute) {\n    return geojson.bbox;\n  }\n  const result = [Infinity, Infinity, -Infinity, -Infinity];\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_0__.coordEach)(geojson, (coord) => {\n    if (result[0] > coord[0]) {\n      result[0] = coord[0];\n    }\n    if (result[1] > coord[1]) {\n      result[1] = coord[1];\n    }\n    if (result[2] < coord[0]) {\n      result[2] = coord[0];\n    }\n    if (result[3] < coord[1]) {\n      result[3] = coord[1];\n    }\n  });\n  return result;\n}\nvar index_default = bbox;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrYmJveEA3LjMuMy9ub2RlX21vZHVsZXMvQHR1cmYvYmJveC9kaXN0L2VzbS9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQUN1QztBQUN2QyxtQ0FBbUM7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFLHFEQUFTO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitiYm94QDcuMy4zXFxub2RlX21vZHVsZXNcXEB0dXJmXFxiYm94XFxkaXN0XFxlc21cXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGluZGV4LnRzXG5pbXBvcnQgeyBjb29yZEVhY2ggfSBmcm9tIFwiQHR1cmYvbWV0YVwiO1xuZnVuY3Rpb24gYmJveChnZW9qc29uLCBvcHRpb25zID0ge30pIHtcbiAgaWYgKGdlb2pzb24uYmJveCAhPSBudWxsICYmIHRydWUgIT09IG9wdGlvbnMucmVjb21wdXRlKSB7XG4gICAgcmV0dXJuIGdlb2pzb24uYmJveDtcbiAgfVxuICBjb25zdCByZXN1bHQgPSBbSW5maW5pdHksIEluZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eV07XG4gIGNvb3JkRWFjaChnZW9qc29uLCAoY29vcmQpID0+IHtcbiAgICBpZiAocmVzdWx0WzBdID4gY29vcmRbMF0pIHtcbiAgICAgIHJlc3VsdFswXSA9IGNvb3JkWzBdO1xuICAgIH1cbiAgICBpZiAocmVzdWx0WzFdID4gY29vcmRbMV0pIHtcbiAgICAgIHJlc3VsdFsxXSA9IGNvb3JkWzFdO1xuICAgIH1cbiAgICBpZiAocmVzdWx0WzJdIDwgY29vcmRbMF0pIHtcbiAgICAgIHJlc3VsdFsyXSA9IGNvb3JkWzBdO1xuICAgIH1cbiAgICBpZiAocmVzdWx0WzNdIDwgY29vcmRbMV0pIHtcbiAgICAgIHJlc3VsdFszXSA9IGNvb3JkWzFdO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGJib3g7XG5leHBvcnQge1xuICBiYm94LFxuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHRcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+bbox@7.3.3/node_modules/@turf/bbox/dist/esm/index.js\n");

/***/ })

};
;