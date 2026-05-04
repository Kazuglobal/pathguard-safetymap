"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+square@7.3.3";
exports.ids = ["vendor-chunks/@turf+square@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+square@7.3.3/node_modules/@turf/square/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+square@7.3.3/node_modules/@turf/square/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ index_default),\n/* harmony export */   square: () => (/* binding */ square)\n/* harmony export */ });\n/* harmony import */ var _turf_distance__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/distance */ \"(ssr)/./node_modules/.pnpm/@turf+distance@7.3.3/node_modules/@turf/distance/dist/esm/index.js\");\n// index.ts\n\nfunction square(bbox) {\n  var west = bbox[0];\n  var south = bbox[1];\n  var east = bbox[2];\n  var north = bbox[3];\n  var horizontalDistance = (0,_turf_distance__WEBPACK_IMPORTED_MODULE_0__.distance)(bbox.slice(0, 2), [east, south]);\n  var verticalDistance = (0,_turf_distance__WEBPACK_IMPORTED_MODULE_0__.distance)(bbox.slice(0, 2), [west, north]);\n  if (horizontalDistance >= verticalDistance) {\n    var verticalMidpoint = (south + north) / 2;\n    return [\n      west,\n      verticalMidpoint - (east - west) / 2,\n      east,\n      verticalMidpoint + (east - west) / 2\n    ];\n  } else {\n    var horizontalMidpoint = (west + east) / 2;\n    return [\n      horizontalMidpoint - (north - south) / 2,\n      south,\n      horizontalMidpoint + (north - south) / 2,\n      north\n    ];\n  }\n}\nvar index_default = square;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrc3F1YXJlQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9zcXVhcmUvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDMEM7QUFDMUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQix3REFBUTtBQUNuQyx5QkFBeUIsd0RBQVE7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitzcXVhcmVANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXHNxdWFyZVxcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgZGlzdGFuY2UgfSBmcm9tIFwiQHR1cmYvZGlzdGFuY2VcIjtcbmZ1bmN0aW9uIHNxdWFyZShiYm94KSB7XG4gIHZhciB3ZXN0ID0gYmJveFswXTtcbiAgdmFyIHNvdXRoID0gYmJveFsxXTtcbiAgdmFyIGVhc3QgPSBiYm94WzJdO1xuICB2YXIgbm9ydGggPSBiYm94WzNdO1xuICB2YXIgaG9yaXpvbnRhbERpc3RhbmNlID0gZGlzdGFuY2UoYmJveC5zbGljZSgwLCAyKSwgW2Vhc3QsIHNvdXRoXSk7XG4gIHZhciB2ZXJ0aWNhbERpc3RhbmNlID0gZGlzdGFuY2UoYmJveC5zbGljZSgwLCAyKSwgW3dlc3QsIG5vcnRoXSk7XG4gIGlmIChob3Jpem9udGFsRGlzdGFuY2UgPj0gdmVydGljYWxEaXN0YW5jZSkge1xuICAgIHZhciB2ZXJ0aWNhbE1pZHBvaW50ID0gKHNvdXRoICsgbm9ydGgpIC8gMjtcbiAgICByZXR1cm4gW1xuICAgICAgd2VzdCxcbiAgICAgIHZlcnRpY2FsTWlkcG9pbnQgLSAoZWFzdCAtIHdlc3QpIC8gMixcbiAgICAgIGVhc3QsXG4gICAgICB2ZXJ0aWNhbE1pZHBvaW50ICsgKGVhc3QgLSB3ZXN0KSAvIDJcbiAgICBdO1xuICB9IGVsc2Uge1xuICAgIHZhciBob3Jpem9udGFsTWlkcG9pbnQgPSAod2VzdCArIGVhc3QpIC8gMjtcbiAgICByZXR1cm4gW1xuICAgICAgaG9yaXpvbnRhbE1pZHBvaW50IC0gKG5vcnRoIC0gc291dGgpIC8gMixcbiAgICAgIHNvdXRoLFxuICAgICAgaG9yaXpvbnRhbE1pZHBvaW50ICsgKG5vcnRoIC0gc291dGgpIC8gMixcbiAgICAgIG5vcnRoXG4gICAgXTtcbiAgfVxufVxudmFyIGluZGV4X2RlZmF1bHQgPSBzcXVhcmU7XG5leHBvcnQge1xuICBpbmRleF9kZWZhdWx0IGFzIGRlZmF1bHQsXG4gIHNxdWFyZVxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+square@7.3.3/node_modules/@turf/square/dist/esm/index.js\n");

/***/ })

};
;