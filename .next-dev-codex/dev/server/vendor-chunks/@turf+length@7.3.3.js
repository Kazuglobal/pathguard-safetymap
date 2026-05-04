"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+length@7.3.3";
exports.ids = ["vendor-chunks/@turf+length@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+length@7.3.3/node_modules/@turf/length/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+length@7.3.3/node_modules/@turf/length/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ index_default),\n/* harmony export */   length: () => (/* binding */ length)\n/* harmony export */ });\n/* harmony import */ var _turf_distance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/distance */ \"(ssr)/./node_modules/.pnpm/@turf+distance@7.3.3/node_modules/@turf/distance/dist/esm/index.js\");\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n// index.ts\n\n\nfunction length(geojson, options = {}) {\n  return (0,_turf_meta__WEBPACK_IMPORTED_MODULE_0__.segmentReduce)(\n    geojson,\n    (previousValue, segment) => {\n      const coords = segment.geometry.coordinates;\n      return previousValue + (0,_turf_distance__WEBPACK_IMPORTED_MODULE_1__.distance)(coords[0], coords[1], options);\n    },\n    0\n  );\n}\nvar index_default = length;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrbGVuZ3RoQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9sZW5ndGgvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQzBDO0FBQ0M7QUFDM0MscUNBQXFDO0FBQ3JDLFNBQVMseURBQWE7QUFDdEI7QUFDQTtBQUNBO0FBQ0EsNkJBQTZCLHdEQUFRO0FBQ3JDLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitsZW5ndGhANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGxlbmd0aFxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgZGlzdGFuY2UgfSBmcm9tIFwiQHR1cmYvZGlzdGFuY2VcIjtcbmltcG9ydCB7IHNlZ21lbnRSZWR1Y2UgfSBmcm9tIFwiQHR1cmYvbWV0YVwiO1xuZnVuY3Rpb24gbGVuZ3RoKGdlb2pzb24sIG9wdGlvbnMgPSB7fSkge1xuICByZXR1cm4gc2VnbWVudFJlZHVjZShcbiAgICBnZW9qc29uLFxuICAgIChwcmV2aW91c1ZhbHVlLCBzZWdtZW50KSA9PiB7XG4gICAgICBjb25zdCBjb29yZHMgPSBzZWdtZW50Lmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgcmV0dXJuIHByZXZpb3VzVmFsdWUgKyBkaXN0YW5jZShjb29yZHNbMF0sIGNvb3Jkc1sxXSwgb3B0aW9ucyk7XG4gICAgfSxcbiAgICAwXG4gICk7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGxlbmd0aDtcbmV4cG9ydCB7XG4gIGluZGV4X2RlZmF1bHQgYXMgZGVmYXVsdCxcbiAgbGVuZ3RoXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+length@7.3.3/node_modules/@turf/length/dist/esm/index.js\n");

/***/ })

};
;