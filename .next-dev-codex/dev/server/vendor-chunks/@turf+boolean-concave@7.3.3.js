"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+boolean-concave@7.3.3";
exports.ids = ["vendor-chunks/@turf+boolean-concave@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+boolean-concave@7.3.3/node_modules/@turf/boolean-concave/dist/esm/index.js":
/*!*************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+boolean-concave@7.3.3/node_modules/@turf/boolean-concave/dist/esm/index.js ***!
  \*************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   booleanConcave: () => (/* binding */ booleanConcave),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_invariant__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/invariant */ \"(ssr)/./node_modules/.pnpm/@turf+invariant@7.3.3/node_modules/@turf/invariant/dist/esm/index.js\");\n// index.ts\n\nfunction booleanConcave(polygon) {\n  const coords = (0,_turf_invariant__WEBPACK_IMPORTED_MODULE_0__.getGeom)(polygon).coordinates;\n  if (coords[0].length <= 4) {\n    return false;\n  }\n  let sign = false;\n  const n = coords[0].length - 1;\n  for (let i = 0; i < n; i++) {\n    const dx1 = coords[0][(i + 2) % n][0] - coords[0][(i + 1) % n][0];\n    const dy1 = coords[0][(i + 2) % n][1] - coords[0][(i + 1) % n][1];\n    const dx2 = coords[0][i][0] - coords[0][(i + 1) % n][0];\n    const dy2 = coords[0][i][1] - coords[0][(i + 1) % n][1];\n    const zcrossproduct = dx1 * dy2 - dy1 * dx2;\n    if (i === 0) {\n      sign = zcrossproduct > 0;\n    } else if (sign !== zcrossproduct > 0) {\n      return true;\n    }\n  }\n  return false;\n}\nvar index_default = booleanConcave;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrYm9vbGVhbi1jb25jYXZlQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9ib29sZWFuLWNvbmNhdmUvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDMEM7QUFDMUM7QUFDQSxpQkFBaUIsd0RBQU87QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQixPQUFPO0FBQ3pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitib29sZWFuLWNvbmNhdmVANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGJvb2xlYW4tY29uY2F2ZVxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgZ2V0R2VvbSB9IGZyb20gXCJAdHVyZi9pbnZhcmlhbnRcIjtcbmZ1bmN0aW9uIGJvb2xlYW5Db25jYXZlKHBvbHlnb24pIHtcbiAgY29uc3QgY29vcmRzID0gZ2V0R2VvbShwb2x5Z29uKS5jb29yZGluYXRlcztcbiAgaWYgKGNvb3Jkc1swXS5sZW5ndGggPD0gNCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBsZXQgc2lnbiA9IGZhbHNlO1xuICBjb25zdCBuID0gY29vcmRzWzBdLmxlbmd0aCAtIDE7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrKSB7XG4gICAgY29uc3QgZHgxID0gY29vcmRzWzBdWyhpICsgMikgJSBuXVswXSAtIGNvb3Jkc1swXVsoaSArIDEpICUgbl1bMF07XG4gICAgY29uc3QgZHkxID0gY29vcmRzWzBdWyhpICsgMikgJSBuXVsxXSAtIGNvb3Jkc1swXVsoaSArIDEpICUgbl1bMV07XG4gICAgY29uc3QgZHgyID0gY29vcmRzWzBdW2ldWzBdIC0gY29vcmRzWzBdWyhpICsgMSkgJSBuXVswXTtcbiAgICBjb25zdCBkeTIgPSBjb29yZHNbMF1baV1bMV0gLSBjb29yZHNbMF1bKGkgKyAxKSAlIG5dWzFdO1xuICAgIGNvbnN0IHpjcm9zc3Byb2R1Y3QgPSBkeDEgKiBkeTIgLSBkeTEgKiBkeDI7XG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHNpZ24gPSB6Y3Jvc3Nwcm9kdWN0ID4gMDtcbiAgICB9IGVsc2UgaWYgKHNpZ24gIT09IHpjcm9zc3Byb2R1Y3QgPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxudmFyIGluZGV4X2RlZmF1bHQgPSBib29sZWFuQ29uY2F2ZTtcbmV4cG9ydCB7XG4gIGJvb2xlYW5Db25jYXZlLFxuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHRcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+boolean-concave@7.3.3/node_modules/@turf/boolean-concave/dist/esm/index.js\n");

/***/ })

};
;