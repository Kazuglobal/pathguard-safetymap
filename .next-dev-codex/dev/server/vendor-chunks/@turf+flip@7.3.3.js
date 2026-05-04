"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+flip@7.3.3";
exports.ids = ["vendor-chunks/@turf+flip@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+flip@7.3.3/node_modules/@turf/flip/dist/esm/index.js":
/*!***************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+flip@7.3.3/node_modules/@turf/flip/dist/esm/index.js ***!
  \***************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ index_default),\n/* harmony export */   flip: () => (/* binding */ flip)\n/* harmony export */ });\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n/* harmony import */ var _turf_clone__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/clone */ \"(ssr)/./node_modules/.pnpm/@turf+clone@7.3.3/node_modules/@turf/clone/dist/esm/index.js\");\n// index.ts\n\n\n\nfunction flip(geojson, options) {\n  var _a;\n  options = options || {};\n  if (!(0,_turf_helpers__WEBPACK_IMPORTED_MODULE_0__.isObject)(options)) throw new Error(\"options is invalid\");\n  const mutate = (_a = options.mutate) != null ? _a : false;\n  if (!geojson) throw new Error(\"geojson is required\");\n  if (mutate === false || mutate === void 0) geojson = (0,_turf_clone__WEBPACK_IMPORTED_MODULE_1__.clone)(geojson);\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_2__.coordEach)(geojson, function(coord) {\n    var x = coord[0];\n    var y = coord[1];\n    coord[0] = y;\n    coord[1] = x;\n  });\n  return geojson;\n}\nvar index_default = flip;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrZmxpcEA3LjMuMy9ub2RlX21vZHVsZXMvQHR1cmYvZmxpcC9kaXN0L2VzbS9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBQ3VDO0FBQ0U7QUFDTDtBQUNwQztBQUNBO0FBQ0E7QUFDQSxPQUFPLHVEQUFRO0FBQ2Y7QUFDQTtBQUNBLHVEQUF1RCxrREFBSztBQUM1RCxFQUFFLHFEQUFTO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBSUU7QUFDRiIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxzMTU5OFxcbWFwc2VmZVxcMjAyNTA2MTVcXG5vZGVfbW9kdWxlc1xcLnBucG1cXEB0dXJmK2ZsaXBANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGZsaXBcXGRpc3RcXGVzbVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gaW5kZXgudHNcbmltcG9ydCB7IGNvb3JkRWFjaCB9IGZyb20gXCJAdHVyZi9tZXRhXCI7XG5pbXBvcnQgeyBpc09iamVjdCB9IGZyb20gXCJAdHVyZi9oZWxwZXJzXCI7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gXCJAdHVyZi9jbG9uZVwiO1xuZnVuY3Rpb24gZmxpcChnZW9qc29uLCBvcHRpb25zKSB7XG4gIHZhciBfYTtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICghaXNPYmplY3Qob3B0aW9ucykpIHRocm93IG5ldyBFcnJvcihcIm9wdGlvbnMgaXMgaW52YWxpZFwiKTtcbiAgY29uc3QgbXV0YXRlID0gKF9hID0gb3B0aW9ucy5tdXRhdGUpICE9IG51bGwgPyBfYSA6IGZhbHNlO1xuICBpZiAoIWdlb2pzb24pIHRocm93IG5ldyBFcnJvcihcImdlb2pzb24gaXMgcmVxdWlyZWRcIik7XG4gIGlmIChtdXRhdGUgPT09IGZhbHNlIHx8IG11dGF0ZSA9PT0gdm9pZCAwKSBnZW9qc29uID0gY2xvbmUoZ2VvanNvbik7XG4gIGNvb3JkRWFjaChnZW9qc29uLCBmdW5jdGlvbihjb29yZCkge1xuICAgIHZhciB4ID0gY29vcmRbMF07XG4gICAgdmFyIHkgPSBjb29yZFsxXTtcbiAgICBjb29yZFswXSA9IHk7XG4gICAgY29vcmRbMV0gPSB4O1xuICB9KTtcbiAgcmV0dXJuIGdlb2pzb247XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGZsaXA7XG5leHBvcnQge1xuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHQsXG4gIGZsaXBcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+flip@7.3.3/node_modules/@turf/flip/dist/esm/index.js\n");

/***/ })

};
;