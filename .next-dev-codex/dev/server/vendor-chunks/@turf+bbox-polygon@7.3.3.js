"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+bbox-polygon@7.3.3";
exports.ids = ["vendor-chunks/@turf+bbox-polygon@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+bbox-polygon@7.3.3/node_modules/@turf/bbox-polygon/dist/esm/index.js":
/*!*******************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+bbox-polygon@7.3.3/node_modules/@turf/bbox-polygon/dist/esm/index.js ***!
  \*******************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   bboxPolygon: () => (/* binding */ bboxPolygon),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n// index.ts\n\nfunction bboxPolygon(bbox, options = {}) {\n  const west = Number(bbox[0]);\n  const south = Number(bbox[1]);\n  const east = Number(bbox[2]);\n  const north = Number(bbox[3]);\n  if (bbox.length === 6) {\n    throw new Error(\n      \"@turf/bbox-polygon does not support BBox with 6 positions\"\n    );\n  }\n  const lowLeft = [west, south];\n  const topLeft = [west, north];\n  const topRight = [east, north];\n  const lowRight = [east, south];\n  return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_0__.polygon)(\n    [[lowLeft, lowRight, topRight, topLeft, lowLeft]],\n    options.properties,\n    { bbox, id: options.id }\n  );\n}\nvar index_default = bboxPolygon;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrYmJveC1wb2x5Z29uQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9iYm94LXBvbHlnb24vZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDd0M7QUFDeEMsdUNBQXVDO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxzREFBTztBQUNoQjtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitiYm94LXBvbHlnb25ANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGJib3gtcG9seWdvblxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgcG9seWdvbiB9IGZyb20gXCJAdHVyZi9oZWxwZXJzXCI7XG5mdW5jdGlvbiBiYm94UG9seWdvbihiYm94LCBvcHRpb25zID0ge30pIHtcbiAgY29uc3Qgd2VzdCA9IE51bWJlcihiYm94WzBdKTtcbiAgY29uc3Qgc291dGggPSBOdW1iZXIoYmJveFsxXSk7XG4gIGNvbnN0IGVhc3QgPSBOdW1iZXIoYmJveFsyXSk7XG4gIGNvbnN0IG5vcnRoID0gTnVtYmVyKGJib3hbM10pO1xuICBpZiAoYmJveC5sZW5ndGggPT09IDYpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIkB0dXJmL2Jib3gtcG9seWdvbiBkb2VzIG5vdCBzdXBwb3J0IEJCb3ggd2l0aCA2IHBvc2l0aW9uc1wiXG4gICAgKTtcbiAgfVxuICBjb25zdCBsb3dMZWZ0ID0gW3dlc3QsIHNvdXRoXTtcbiAgY29uc3QgdG9wTGVmdCA9IFt3ZXN0LCBub3J0aF07XG4gIGNvbnN0IHRvcFJpZ2h0ID0gW2Vhc3QsIG5vcnRoXTtcbiAgY29uc3QgbG93UmlnaHQgPSBbZWFzdCwgc291dGhdO1xuICByZXR1cm4gcG9seWdvbihcbiAgICBbW2xvd0xlZnQsIGxvd1JpZ2h0LCB0b3BSaWdodCwgdG9wTGVmdCwgbG93TGVmdF1dLFxuICAgIG9wdGlvbnMucHJvcGVydGllcyxcbiAgICB7IGJib3gsIGlkOiBvcHRpb25zLmlkIH1cbiAgKTtcbn1cbnZhciBpbmRleF9kZWZhdWx0ID0gYmJveFBvbHlnb247XG5leHBvcnQge1xuICBiYm94UG9seWdvbixcbiAgaW5kZXhfZGVmYXVsdCBhcyBkZWZhdWx0XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+bbox-polygon@7.3.3/node_modules/@turf/bbox-polygon/dist/esm/index.js\n");

/***/ })

};
;