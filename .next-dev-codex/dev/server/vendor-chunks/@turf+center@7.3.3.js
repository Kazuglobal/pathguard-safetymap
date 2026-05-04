"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+center@7.3.3";
exports.ids = ["vendor-chunks/@turf+center@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+center@7.3.3/node_modules/@turf/center/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+center@7.3.3/node_modules/@turf/center/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   center: () => (/* binding */ center),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_bbox__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/bbox */ \"(ssr)/./node_modules/.pnpm/@turf+bbox@7.3.3/node_modules/@turf/bbox/dist/esm/index.js\");\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n// index.ts\n\n\nfunction center(geojson, options = {}) {\n  const ext = (0,_turf_bbox__WEBPACK_IMPORTED_MODULE_0__.bbox)(geojson);\n  const x = (ext[0] + ext[2]) / 2;\n  const y = (ext[1] + ext[3]) / 2;\n  return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_1__.point)([x, y], options.properties, options);\n}\nvar index_default = center;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrY2VudGVyQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9jZW50ZXIvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ2tDO0FBQ0k7QUFDdEMscUNBQXFDO0FBQ3JDLGNBQWMsZ0RBQUk7QUFDbEI7QUFDQTtBQUNBLFNBQVMsb0RBQUs7QUFDZDtBQUNBO0FBSUU7QUFDRiIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxzMTU5OFxcbWFwc2VmZVxcMjAyNTA2MTVcXG5vZGVfbW9kdWxlc1xcLnBucG1cXEB0dXJmK2NlbnRlckA3LjMuM1xcbm9kZV9tb2R1bGVzXFxAdHVyZlxcY2VudGVyXFxkaXN0XFxlc21cXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGluZGV4LnRzXG5pbXBvcnQgeyBiYm94IH0gZnJvbSBcIkB0dXJmL2Jib3hcIjtcbmltcG9ydCB7IHBvaW50IH0gZnJvbSBcIkB0dXJmL2hlbHBlcnNcIjtcbmZ1bmN0aW9uIGNlbnRlcihnZW9qc29uLCBvcHRpb25zID0ge30pIHtcbiAgY29uc3QgZXh0ID0gYmJveChnZW9qc29uKTtcbiAgY29uc3QgeCA9IChleHRbMF0gKyBleHRbMl0pIC8gMjtcbiAgY29uc3QgeSA9IChleHRbMV0gKyBleHRbM10pIC8gMjtcbiAgcmV0dXJuIHBvaW50KFt4LCB5XSwgb3B0aW9ucy5wcm9wZXJ0aWVzLCBvcHRpb25zKTtcbn1cbnZhciBpbmRleF9kZWZhdWx0ID0gY2VudGVyO1xuZXhwb3J0IHtcbiAgY2VudGVyLFxuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHRcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+center@7.3.3/node_modules/@turf/center/dist/esm/index.js\n");

/***/ })

};
;