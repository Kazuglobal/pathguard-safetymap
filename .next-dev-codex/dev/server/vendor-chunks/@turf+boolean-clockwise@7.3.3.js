"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+boolean-clockwise@7.3.3";
exports.ids = ["vendor-chunks/@turf+boolean-clockwise@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+boolean-clockwise@7.3.3/node_modules/@turf/boolean-clockwise/dist/esm/index.js":
/*!*****************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+boolean-clockwise@7.3.3/node_modules/@turf/boolean-clockwise/dist/esm/index.js ***!
  \*****************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   booleanClockwise: () => (/* binding */ booleanClockwise),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_invariant__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/invariant */ \"(ssr)/./node_modules/.pnpm/@turf+invariant@7.3.3/node_modules/@turf/invariant/dist/esm/index.js\");\n// index.ts\n\nfunction booleanClockwise(line) {\n  const ring = (0,_turf_invariant__WEBPACK_IMPORTED_MODULE_0__.getCoords)(line);\n  let sum = 0;\n  let i = 1;\n  let prev;\n  let cur;\n  while (i < ring.length) {\n    prev = cur || ring[0];\n    cur = ring[i];\n    sum += (cur[0] - prev[0]) * (cur[1] + prev[1]);\n    i++;\n  }\n  return sum > 0;\n}\nvar index_default = booleanClockwise;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrYm9vbGVhbi1jbG9ja3dpc2VANy4zLjMvbm9kZV9tb2R1bGVzL0B0dXJmL2Jvb2xlYW4tY2xvY2t3aXNlL2Rpc3QvZXNtL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFBO0FBQzRDO0FBQzVDO0FBQ0EsZUFBZSwwREFBUztBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitib29sZWFuLWNsb2Nrd2lzZUA3LjMuM1xcbm9kZV9tb2R1bGVzXFxAdHVyZlxcYm9vbGVhbi1jbG9ja3dpc2VcXGRpc3RcXGVzbVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gaW5kZXgudHNcbmltcG9ydCB7IGdldENvb3JkcyB9IGZyb20gXCJAdHVyZi9pbnZhcmlhbnRcIjtcbmZ1bmN0aW9uIGJvb2xlYW5DbG9ja3dpc2UobGluZSkge1xuICBjb25zdCByaW5nID0gZ2V0Q29vcmRzKGxpbmUpO1xuICBsZXQgc3VtID0gMDtcbiAgbGV0IGkgPSAxO1xuICBsZXQgcHJldjtcbiAgbGV0IGN1cjtcbiAgd2hpbGUgKGkgPCByaW5nLmxlbmd0aCkge1xuICAgIHByZXYgPSBjdXIgfHwgcmluZ1swXTtcbiAgICBjdXIgPSByaW5nW2ldO1xuICAgIHN1bSArPSAoY3VyWzBdIC0gcHJldlswXSkgKiAoY3VyWzFdICsgcHJldlsxXSk7XG4gICAgaSsrO1xuICB9XG4gIHJldHVybiBzdW0gPiAwO1xufVxudmFyIGluZGV4X2RlZmF1bHQgPSBib29sZWFuQ2xvY2t3aXNlO1xuZXhwb3J0IHtcbiAgYm9vbGVhbkNsb2Nrd2lzZSxcbiAgaW5kZXhfZGVmYXVsdCBhcyBkZWZhdWx0XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+boolean-clockwise@7.3.3/node_modules/@turf/boolean-clockwise/dist/esm/index.js\n");

/***/ })

};
;