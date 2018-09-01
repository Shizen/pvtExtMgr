
// jshint esversion: 6


if(process.argv.length !== 5) {
  console.error('updateExtension called with the wrong number of arguments.\nnode updateExtension.js {extName} {extPath} {source}\n\nAnd you should not run it manually anyway');
}
let extPath = decodeURI(process.argv[3]);
let extName = decodeURI(process.argv[2]);
let source = decodeURI(process.argv[4]);

const util = require('util');
console.log(util.format("[%s]:%s -> `%s`", extName, source, extPath));

const update = require('./update.js');
update(extName, extPath, source);

// console.log(arguments.length);
// for(var idx = 0; idx < arguments.length; idx++) {
//   console.log(util.format("[%s]: %s", idx, arguments[idx]));
// }

// process.argv.forEach((_val, _idx, _arr) => {
//   console.log(`${_idx} : ${_val}`);
// });

