"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+union@7.3.3";
exports.ids = ["vendor-chunks/@turf+union@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+union@7.3.3/node_modules/@turf/union/dist/esm/index.js":
/*!*****************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+union@7.3.3/node_modules/@turf/union/dist/esm/index.js ***!
  \*****************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ index_default),\n/* harmony export */   union: () => (/* binding */ union2)\n/* harmony export */ });\n/* harmony import */ var polyclip_ts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! polyclip-ts */ \"(ssr)/./node_modules/.pnpm/polyclip-ts@0.16.8/node_modules/polyclip-ts/dist/esm/index.js\");\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n// index.ts\n\n\n\nfunction union2(features, options = {}) {\n  const geoms = [];\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_1__.geomEach)(features, (geom) => {\n    geoms.push(geom.coordinates);\n  });\n  if (geoms.length < 2) {\n    throw new Error(\"Must have at least 2 geometries\");\n  }\n  const unioned = polyclip_ts__WEBPACK_IMPORTED_MODULE_0__.union(geoms[0], ...geoms.slice(1));\n  if (unioned.length === 0) return null;\n  if (unioned.length === 1) return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_2__.polygon)(unioned[0], options.properties);\n  else return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_2__.multiPolygon)(unioned, options.properties);\n}\nvar index_default = union2;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrdW5pb25ANy4zLjMvbm9kZV9tb2R1bGVzL0B0dXJmL3VuaW9uL2Rpc3QvZXNtL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7QUFDd0M7QUFDYztBQUNoQjtBQUN0QyxzQ0FBc0M7QUFDdEM7QUFDQSxFQUFFLG9EQUFRO0FBQ1Y7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLDhDQUFjO0FBQ2hDO0FBQ0EsbUNBQW1DLHNEQUFPO0FBQzFDLGNBQWMsMkRBQVk7QUFDMUI7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZit1bmlvbkA3LjMuM1xcbm9kZV9tb2R1bGVzXFxAdHVyZlxcdW5pb25cXGRpc3RcXGVzbVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gaW5kZXgudHNcbmltcG9ydCAqIGFzIHBvbHljbGlwIGZyb20gXCJwb2x5Y2xpcC10c1wiO1xuaW1wb3J0IHsgbXVsdGlQb2x5Z29uLCBwb2x5Z29uIH0gZnJvbSBcIkB0dXJmL2hlbHBlcnNcIjtcbmltcG9ydCB7IGdlb21FYWNoIH0gZnJvbSBcIkB0dXJmL21ldGFcIjtcbmZ1bmN0aW9uIHVuaW9uMihmZWF0dXJlcywgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IGdlb21zID0gW107XG4gIGdlb21FYWNoKGZlYXR1cmVzLCAoZ2VvbSkgPT4ge1xuICAgIGdlb21zLnB1c2goZ2VvbS5jb29yZGluYXRlcyk7XG4gIH0pO1xuICBpZiAoZ2VvbXMubGVuZ3RoIDwgMikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk11c3QgaGF2ZSBhdCBsZWFzdCAyIGdlb21ldHJpZXNcIik7XG4gIH1cbiAgY29uc3QgdW5pb25lZCA9IHBvbHljbGlwLnVuaW9uKGdlb21zWzBdLCAuLi5nZW9tcy5zbGljZSgxKSk7XG4gIGlmICh1bmlvbmVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gIGlmICh1bmlvbmVkLmxlbmd0aCA9PT0gMSkgcmV0dXJuIHBvbHlnb24odW5pb25lZFswXSwgb3B0aW9ucy5wcm9wZXJ0aWVzKTtcbiAgZWxzZSByZXR1cm4gbXVsdGlQb2x5Z29uKHVuaW9uZWQsIG9wdGlvbnMucHJvcGVydGllcyk7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IHVuaW9uMjtcbmV4cG9ydCB7XG4gIGluZGV4X2RlZmF1bHQgYXMgZGVmYXVsdCxcbiAgdW5pb24yIGFzIHVuaW9uXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+union@7.3.3/node_modules/@turf/union/dist/esm/index.js\n");

/***/ })

};
;