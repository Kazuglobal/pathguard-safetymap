"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+centroid@7.3.3";
exports.ids = ["vendor-chunks/@turf+centroid@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+centroid@7.3.3/node_modules/@turf/centroid/dist/esm/index.js":
/*!***********************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+centroid@7.3.3/node_modules/@turf/centroid/dist/esm/index.js ***!
  \***********************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   centroid: () => (/* binding */ centroid),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n// index.ts\n\n\nfunction centroid(geojson, options = {}) {\n  let xSum = 0;\n  let ySum = 0;\n  let len = 0;\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_0__.coordEach)(\n    geojson,\n    function(coord) {\n      xSum += coord[0];\n      ySum += coord[1];\n      len++;\n    },\n    true\n  );\n  return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_1__.point)([xSum / len, ySum / len], options.properties);\n}\nvar index_default = centroid;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrY2VudHJvaWRANy4zLjMvbm9kZV9tb2R1bGVzL0B0dXJmL2NlbnRyb2lkL2Rpc3QvZXNtL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTtBQUNzQztBQUNDO0FBQ3ZDLHVDQUF1QztBQUN2QztBQUNBO0FBQ0E7QUFDQSxFQUFFLHFEQUFTO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsU0FBUyxvREFBSztBQUNkO0FBQ0E7QUFJRTtBQUNGIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXHMxNTk4XFxtYXBzZWZlXFwyMDI1MDYxNVxcbm9kZV9tb2R1bGVzXFwucG5wbVxcQHR1cmYrY2VudHJvaWRANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGNlbnRyb2lkXFxkaXN0XFxlc21cXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGluZGV4LnRzXG5pbXBvcnQgeyBwb2ludCB9IGZyb20gXCJAdHVyZi9oZWxwZXJzXCI7XG5pbXBvcnQgeyBjb29yZEVhY2ggfSBmcm9tIFwiQHR1cmYvbWV0YVwiO1xuZnVuY3Rpb24gY2VudHJvaWQoZ2VvanNvbiwgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCB4U3VtID0gMDtcbiAgbGV0IHlTdW0gPSAwO1xuICBsZXQgbGVuID0gMDtcbiAgY29vcmRFYWNoKFxuICAgIGdlb2pzb24sXG4gICAgZnVuY3Rpb24oY29vcmQpIHtcbiAgICAgIHhTdW0gKz0gY29vcmRbMF07XG4gICAgICB5U3VtICs9IGNvb3JkWzFdO1xuICAgICAgbGVuKys7XG4gICAgfSxcbiAgICB0cnVlXG4gICk7XG4gIHJldHVybiBwb2ludChbeFN1bSAvIGxlbiwgeVN1bSAvIGxlbl0sIG9wdGlvbnMucHJvcGVydGllcyk7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGNlbnRyb2lkO1xuZXhwb3J0IHtcbiAgY2VudHJvaWQsXG4gIGluZGV4X2RlZmF1bHQgYXMgZGVmYXVsdFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+centroid@7.3.3/node_modules/@turf/centroid/dist/esm/index.js\n");

/***/ })

};
;