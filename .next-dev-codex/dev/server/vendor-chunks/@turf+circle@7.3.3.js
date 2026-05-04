"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@turf+circle@7.3.3";
exports.ids = ["vendor-chunks/@turf+circle@7.3.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@turf+circle@7.3.3/node_modules/@turf/circle/dist/esm/index.js":
/*!*******************************************************************************************!*\
  !*** ./node_modules/.pnpm/@turf+circle@7.3.3/node_modules/@turf/circle/dist/esm/index.js ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   circle: () => (/* binding */ circle),\n/* harmony export */   \"default\": () => (/* binding */ index_default)\n/* harmony export */ });\n/* harmony import */ var _turf_destination__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @turf/destination */ \"(ssr)/./node_modules/.pnpm/@turf+destination@7.3.3/node_modules/@turf/destination/dist/esm/index.js\");\n/* harmony import */ var _turf_helpers__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @turf/helpers */ \"(ssr)/./node_modules/.pnpm/@turf+helpers@7.3.3/node_modules/@turf/helpers/dist/esm/index.js\");\n// index.ts\n\n\nfunction circle(center, radius, options = {}) {\n  const steps = options.steps || 64;\n  const properties = options.properties ? options.properties : !Array.isArray(center) && center.type === \"Feature\" && center.properties ? center.properties : {};\n  const coordinates = [];\n  for (let i = 0; i < steps; i++) {\n    coordinates.push(\n      (0,_turf_destination__WEBPACK_IMPORTED_MODULE_0__.destination)(center, radius, i * -360 / steps, options).geometry.coordinates\n    );\n  }\n  coordinates.push(coordinates[0]);\n  return (0,_turf_helpers__WEBPACK_IMPORTED_MODULE_1__.polygon)([coordinates], properties);\n}\nvar index_default = circle;\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHR1cmYrY2lyY2xlQDcuMy4zL25vZGVfbW9kdWxlcy9AdHVyZi9jaXJjbGUvZGlzdC9lc20vaW5kZXguanMiLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBO0FBQ2dEO0FBQ1I7QUFDeEMsNENBQTRDO0FBQzVDO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQixXQUFXO0FBQzdCO0FBQ0EsTUFBTSw4REFBVztBQUNqQjtBQUNBO0FBQ0E7QUFDQSxTQUFTLHNEQUFPO0FBQ2hCO0FBQ0E7QUFJRTtBQUNGIiwic291cmNlcyI6WyJDOlxcVXNlcnNcXHMxNTk4XFxtYXBzZWZlXFwyMDI1MDYxNVxcbm9kZV9tb2R1bGVzXFwucG5wbVxcQHR1cmYrY2lyY2xlQDcuMy4zXFxub2RlX21vZHVsZXNcXEB0dXJmXFxjaXJjbGVcXGRpc3RcXGVzbVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gaW5kZXgudHNcbmltcG9ydCB7IGRlc3RpbmF0aW9uIH0gZnJvbSBcIkB0dXJmL2Rlc3RpbmF0aW9uXCI7XG5pbXBvcnQgeyBwb2x5Z29uIH0gZnJvbSBcIkB0dXJmL2hlbHBlcnNcIjtcbmZ1bmN0aW9uIGNpcmNsZShjZW50ZXIsIHJhZGl1cywgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IHN0ZXBzID0gb3B0aW9ucy5zdGVwcyB8fCA2NDtcbiAgY29uc3QgcHJvcGVydGllcyA9IG9wdGlvbnMucHJvcGVydGllcyA/IG9wdGlvbnMucHJvcGVydGllcyA6ICFBcnJheS5pc0FycmF5KGNlbnRlcikgJiYgY2VudGVyLnR5cGUgPT09IFwiRmVhdHVyZVwiICYmIGNlbnRlci5wcm9wZXJ0aWVzID8gY2VudGVyLnByb3BlcnRpZXMgOiB7fTtcbiAgY29uc3QgY29vcmRpbmF0ZXMgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGVwczsgaSsrKSB7XG4gICAgY29vcmRpbmF0ZXMucHVzaChcbiAgICAgIGRlc3RpbmF0aW9uKGNlbnRlciwgcmFkaXVzLCBpICogLTM2MCAvIHN0ZXBzLCBvcHRpb25zKS5nZW9tZXRyeS5jb29yZGluYXRlc1xuICAgICk7XG4gIH1cbiAgY29vcmRpbmF0ZXMucHVzaChjb29yZGluYXRlc1swXSk7XG4gIHJldHVybiBwb2x5Z29uKFtjb29yZGluYXRlc10sIHByb3BlcnRpZXMpO1xufVxudmFyIGluZGV4X2RlZmF1bHQgPSBjaXJjbGU7XG5leHBvcnQge1xuICBjaXJjbGUsXG4gIGluZGV4X2RlZmF1bHQgYXMgZGVmYXVsdFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@turf+circle@7.3.3/node_modules/@turf/circle/dist/esm/index.js\n");

/***/ })

};
;