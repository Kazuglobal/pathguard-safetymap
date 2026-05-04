"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+boolean-intersects@7.3.3";
exports.ids = ["vendor-chunks/@turf+boolean-intersects@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+boolean-intersects@7.3.3/node_modules/@turf/boolean-intersects/dist/esm/index.js":
/*!*******************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+boolean-intersects@7.3.3/node_modules/@turf/boolean-intersects/dist/esm/index.js ***!
  \*******************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   booleanIntersects: () => (/* binding */ booleanIntersects),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_boolean_disjoint__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/boolean-disjoint */ \"(ssr)/./node_modules/.pnpm/@turf+boolean-disjoint@7.3.3/node_modules/@turf/boolean-disjoint/dist/esm/index.js\");\n/* harmony import */ var _turf_meta__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/meta */ \"(ssr)/./node_modules/.pnpm/@turf+meta@7.3.3/node_modules/@turf/meta/dist/esm/index.js\");\n// index.ts\n\n\nfunction booleanIntersects(feature1, feature2, {\n  ignoreSelfIntersections = true\n} = {}) {\n  let bool = false;\n  (0,_turf_meta__WEBPACK_IMPORTED_MODULE_0__.flattenEach)(feature1, (flatten1) => {\n    (0,_turf_meta__WEBPACK_IMPORTED_MODULE_0__.flattenEach)(feature2, (flatten2) => {\n      if (bool === true) {\n        return true;\n      }\n      bool = !(0,_turf_boolean_disjoint__WEBPACK_IMPORTED_MODULE_1__.booleanDisjoint)(flatten1.geometry, flatten2.geometry, {\n        ignoreSelfIntersections\n      });\n    });\n  });\n  return bool;\n}\nvar index_default = booleanIntersects;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrYm9vbGVhbi1pbnRlcnNlY3RzQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9ib29sZWFuLWludGVyc2VjdHMvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ3lEO0FBQ2hCO0FBQ3pDO0FBQ0E7QUFDQSxFQUFFLElBQUk7QUFDTjtBQUNBLEVBQUUsdURBQVc7QUFDYixJQUFJLHVEQUFXO0FBQ2Y7QUFDQTtBQUNBO0FBQ0EsY0FBYyx1RUFBZTtBQUM3QjtBQUNBLE9BQU87QUFDUCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUlFO0FBQ0YiLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcczE1OThcXG1hcHNlZmVcXDIwMjUwNjE1XFxub2RlX21vZHVsZXNcXC5wbnBtXFxAdHVyZitib29sZWFuLWludGVyc2VjdHNANy4zLjNcXG5vZGVfbW9kdWxlc1xcQHR1cmZcXGJvb2xlYW4taW50ZXJzZWN0c1xcZGlzdFxcZXNtXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuaW1wb3J0IHsgYm9vbGVhbkRpc2pvaW50IH0gZnJvbSBcIkB0dXJmL2Jvb2xlYW4tZGlzam9pbnRcIjtcbmltcG9ydCB7IGZsYXR0ZW5FYWNoIH0gZnJvbSBcIkB0dXJmL21ldGFcIjtcbmZ1bmN0aW9uIGJvb2xlYW5JbnRlcnNlY3RzKGZlYXR1cmUxLCBmZWF0dXJlMiwge1xuICBpZ25vcmVTZWxmSW50ZXJzZWN0aW9ucyA9IHRydWVcbn0gPSB7fSkge1xuICBsZXQgYm9vbCA9IGZhbHNlO1xuICBmbGF0dGVuRWFjaChmZWF0dXJlMSwgKGZsYXR0ZW4xKSA9PiB7XG4gICAgZmxhdHRlbkVhY2goZmVhdHVyZTIsIChmbGF0dGVuMikgPT4ge1xuICAgICAgaWYgKGJvb2wgPT09IHRydWUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBib29sID0gIWJvb2xlYW5EaXNqb2ludChmbGF0dGVuMS5nZW9tZXRyeSwgZmxhdHRlbjIuZ2VvbWV0cnksIHtcbiAgICAgICAgaWdub3JlU2VsZkludGVyc2VjdGlvbnNcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIGJvb2w7XG59XG52YXIgaW5kZXhfZGVmYXVsdCA9IGJvb2xlYW5JbnRlcnNlY3RzO1xuZXhwb3J0IHtcbiAgYm9vbGVhbkludGVyc2VjdHMsXG4gIGluZGV4X2RlZmF1bHQgYXMgZGVmYXVsdFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+boolean-intersects@7.3.3/node_modules/@turf/boolean-intersects/dist/esm/index.js\n");

/***/ })

};
;