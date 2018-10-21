const util = require("util");
let values = [];
let done = false;
let count = 0;

// vscode has some perm/access issues in the extension host environment which I haven't bother to work out
// So I'm going to avoid forking/ipc for the moment.

process.on('message', function(m) {
  console.log("Got message", m);
  // values.push(m);
  process.send(util.format("Received %s", m));
  // done = true;
  // if(values.length > 2) {
  //   process.send(util.format("Received %s", values.join(",")));
  // }
});

process.on('disconnect', function() {
  console.log("Lost connection to parent.");
  process.exit();
});

function eventLoop() {
  count += 1;
  if(count % 1000000 === 0) {
    // console.log("cycle ", count);
    process.send("Alive");
  }
  if(!done) {
    process.nextTick(eventLoop);
  }
}


if(process.channel) {
  process.send("Ready");
  console.log("Got channel");
}

eventLoop();