"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+sample@7.3.3";
exports.ids = ["vendor-chunks/@turf+sample@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+sample@7.3.3/node_modules/@turf/sample/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+sample@7.3.3/node_modules/@turf/sample/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ index_default),\n/* harmony export */   sample: () => (/* binding */ sample)\n/* harmony export */ });\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n// index.ts\n\nfunction sample(fc, num) {\n  if (!fc) throw new Error(\"fc is required\");\n  if (num === null || num === void 0) throw new Error(\"num is required\");\n  if (typeof num !== \"number\") throw new Error(\"num must be a number\");\n  var outFC = (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_0__.featureCollection)(getRandomSubarray(fc.features, num));\n  return outFC;\n}\nfunction getRandomSubarray(arr, size) {\n  var shuffled = arr.slice(0), i = arr.length, min = i - size, temp, index;\n  while (i-- > min) {\n    index = Math.floor((i + 1) * Math.random());\n    temp = shuffled[index];\n    shuffled[index] = shuffled[i];\n    shuffled[i] = temp;\n  }\n  return shuffled.slice(min);\n}\nvar index_default = sample;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrc2FtcGxlQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9zYW1wbGUvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDa0Q7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFjLGdFQUFpQjtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitzYW1wbGVANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXHNhbXBsZVxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgZmVhdHVyZUNvbGxlY3Rpb24gfSBmcm9tIFwiQHR1cmYvaGVscGVyc1wiO1xuZnVuY3Rpb24gc2FtcGxlKGZjLCBudW0pIHtcbiAgaWYgKCFmYykgdGhyb3cgbmV3IEVycm9yKFwiZmMgaXMgcmVxdWlyZWRcIik7XG4gIGlmIChudW0gPT09IG51bGwgfHwgbnVtID09PSB2b2lkIDApIHRocm93IG5ldyBFcnJvcihcIm51bSBpcyByZXF1aXJlZFwiKTtcbiAgaWYgKHR5cGVvZiBudW0gIT09IFwibnVtYmVyXCIpIHRocm93IG5ldyBFcnJvcihcIm51bSBtdXN0IGJlIGEgbnVtYmVyXCIpO1xuICB2YXIgb3V0RkMgPSBmZWF0dXJlQ29sbGVjdGlvbihnZXRSYW5kb21TdWJhcnJheShmYy5mZWF0dXJlcywgbnVtKSk7XG4gIHJldHVybiBvdXRGQztcbn1cbmZ1bmN0aW9uIGdldFJhbmRvbVN1YmFycmF5KGFyciwgc2l6ZSkge1xuICB2YXIgc2h1ZmZsZWQgPSBhcnIuc2xpY2UoMCksIGkgPSBhcnIubGVuZ3RoLCBtaW4gPSBpIC0gc2l6ZSwgdGVtcCwgaW5kZXg7XG4gIHdoaWxlIChpLS0gPiBtaW4pIHtcbiAgICBpbmRleCA9IE1hdGguZmxvb3IoKGkgKyAxKSAqIE1hdGgucmFuZG9tKCkpO1xuICAgIHRlbXAgPSBzaHVmZmxlZFtpbmRleF07XG4gICAgc2h1ZmZsZWRbaW5kZXhdID0gc2h1ZmZsZWRbaV07XG4gICAgc2h1ZmZsZWRbaV0gPSB0ZW1wO1xuICB9XG4gIHJldHVybiBzaHVmZmxlZC5zbGljZShtaW4pO1xufVxudmFyIGluZGV4X2RlZmF1bHQgPSBzYW1wbGU7XG5leHBvcnQge1xuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHQsXG4gIHNhbXBsZVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+sample@7.3.3/node_modules/@turf/sample/dist/esm/index.js\n");

/***/ })

};
;