"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+convex@7.3.3";
exports.ids = ["vendor-chunks/@turf+convex@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+convex@7.3.3/node_modules/@turf/convex/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+convex@7.3.3/node_modules/@turf/convex/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   convex: () => (/* binding */ convex),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n/* harmony import */ var concaveman__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! concaveman */ \"(ssr)/./node_modules/.pnpm/concaveman@1.2.1/node_modules/concaveman/index.js\");\n// index.ts\n\n\n\nfunction convex(geojson, options = {}) {\n  options.concavity = options.concavity || Infinity;\n  const points = [];\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_1__.coordEach)(geojson, (coord) => {\n    points.push([coord[0], coord[1]]);\n  });\n  if (!points.length) {\n    return null;\n  }\n  const convexHull = concaveman__WEBPACK_IMPORTED_MODULE_0__(points, options.concavity);\n  if (convexHull.length > 3) {\n    return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_2__.polygon)([convexHull]);\n  }\n  return null;\n}\nvar index_default = convex;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrY29udmV4QDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9jb252ZXgvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTtBQUN3QztBQUNEO0FBQ0g7QUFDcEMscUNBQXFDO0FBQ3JDO0FBQ0E7QUFDQSxFQUFFLHFEQUFTO0FBQ1g7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EscUJBQXFCLHVDQUFVO0FBQy9CO0FBQ0EsV0FBVyxzREFBTztBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitjb252ZXhANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGNvbnZleFxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgcG9seWdvbiB9IGZyb20gXCJAdHVyZi9oZWxwZXJzXCI7XG5pbXBvcnQgeyBjb29yZEVhY2ggfSBmcm9tIFwiQHR1cmYvbWV0YVwiO1xuaW1wb3J0IGNvbmNhdmVtYW4gZnJvbSBcImNvbmNhdmVtYW5cIjtcbmZ1bmN0aW9uIGNvbnZleChnZW9qc29uLCBvcHRpb25zID0ge30pIHtcbiAgb3B0aW9ucy5jb25jYXZpdHkgPSBvcHRpb25zLmNvbmNhdml0eSB8fCBJbmZpbml0eTtcbiAgY29uc3QgcG9pbnRzID0gW107XG4gIGNvb3JkRWFjaChnZW9qc29uLCAoY29vcmQpID0+IHtcbiAgICBwb2ludHMucHVzaChbY29vcmRbMF0sIGNvb3JkWzFdXSk7XG4gIH0pO1xuICBpZiAoIXBvaW50cy5sZW5ndGgpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCBjb252ZXhIdWxsID0gY29uY2F2ZW1hbihwb2ludHMsIG9wdGlvbnMuY29uY2F2aXR5KTtcbiAgaWYgKGNvbnZleEh1bGwubGVuZ3RoID4gMykge1xuICAgIHJldHVybiBwb2x5Z29uKFtjb252ZXhIdWxsXSk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGNvbnZleDtcbmV4cG9ydCB7XG4gIGNvbnZleCxcbiAgaW5kZXhfZGVmYXVsdCBhcyBkZWZhdWx0XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+convex@7.3.3/node_modules/@turf/convex/dist/esm/index.js\n");

/***/ })

};
;