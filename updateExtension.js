/**
 * @file The `updateExtension.js` file provides the `cli` glue for worker thread invocation of the `update` function
 * @author Shin <shin@shinworks.co>
 */
// jshint esversion: 6

if(process.argv.length < 5) {
  console.error('updateExtension called with the wrong number of arguments.\nnode updateExtension.js {extName} {extPath} {source}\n\nAnd you should not run it manually anyway');
  process.exit(1);
}
let extPath = decodeURI(process.argv[3]);
let extName = decodeURI(process.argv[2]);
let source = decodeURI(process.argv[4]);
let clean = decodeURI(process.argv[5]);
if(clean === "true") { 
  clean = true; 
} else {
  clean = false;
}

console.log("Checking for updates to %s (%s)", extName, source);

const update = require('./update.js');
update(extName, extPath, source, clean);


