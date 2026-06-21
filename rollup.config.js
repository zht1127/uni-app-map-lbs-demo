import resolve from "@rollup/plugin-node-resolve";  // 解析第三方依赖
import commonjs from "@rollup/plugin-commonjs"; // 将 CommonJS 模块转换为 ES6
import terser from "@rollup/plugin-terser" //转义 ES6/7 代码为 ES5

export default {
	plugins: [resolve(),commonjs(),terser()],
	input: [
		'utils/wz_location.js',
	],
	output: {
		file: 'utils/wz_sdk_uniapp.js',
		format: 'es' // 使用立即执行函数(iife)格式
	}
};
