/**
 * @file The `extension.js` file is the base hook-in file for a vscode extension.
 * @author Shin <shin@shinworks.co>
 */

// jshint esversion: 6

/**
 * @module pvtExtMgr
 * @desc
 * # Private Extension Manager
 * 
 * This is a "simple" little vscode extension which leverages `npm`'s `semver` module (and `semver-extra` ;) ) to allow for
 * tracking and auto-updating of vscode extensions from private git repos using semver maths.
 */
let m;  // hax to trick vscode's intellisense

/**
 * @const {object} vscode visual studio codes's built in api object.
 */
const vscode = require('vscode');
/**
 * @const {object} path `nodejs`'s built-in path module. 
 */
const path = require('path');
/**
 * @const {object} cp `nodejs`'s built-in child_process module.
 */
const cp = require('child_process');
/**
 * @const {object} util `nodejs`'s built-in util module.
 */
const util = require('util');
/**
 * @const {object} net `nodejs`'s built-in net module.
 */
const net = require('net');

/**
 * @internal
 * @desc 
 * Perhaps I should go against the coding convensions of js coders everywhere and use capitalized var names for local scoped objects...
 * I mean I did in Frontiers.  Anyway, this is the closure-scoped var which holds the manager's state within vscode.
 */
let taskState = { taskComplete: taskComplete};     // closure scoped like a boss :/

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('pvtExtMgr.checkExtensions', function () {
    try {
      if(taskState !== undefined) {
        if(taskState.inProgress) {
          vscode.window.showErrorMessage("Private Extension Manager: Extension update already in progress.");
          return;
        }
      } else {
        taskState = {
          taskComplete: taskComplete
        };
      }

      // // The behavior of this UI feature in vscode has changed.  It no longer updates even during async operations.
      // They must have changed how extensions are getting executed.
      taskState.inProgress = true;
      // if(!taskState.statusBarItem) {
      //   taskState.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
      // }
      // taskState.statusBarItem.text = "PvtExtMgr: Updating private extensions";
      // taskState.statusBarItem.show();

      vscode.window.withProgress({ 
        location: vscode.ProgressLocation.Notification,
        title: 'Checking extensions',
        cancellable: true,
      }, (_oProgress, _oToken) => {
        return new Promise((resolve, reject) => {
          _oToken.onCancellationRequested(() => {
            taskState.taskComplete();
            console.log("Cancelled by user request");
          });
          taskState.progressBar = _oProgress;
          return updateExtensions(context.extensionPath).then((r) => {
            taskState.taskComplete();
            resolve(r);
          }).catch((e) => {
            console.log("Error", e);
            reject(e);
          });
        });
      });

    } catch(e) {
      console.error(e.message);
    }
  }));
}
exports.activate = activate;

function deactivate() {
    if(taskState.statusBarItem) {
        taskState.statusBarItem.hide();
        taskState.statusBarItem = undefined;  // tots unnecessary, brah.
    }
    taskState = undefined;
}
exports.deactivate = deactivate;




/**
 * @desc
 * This is the work horse/top level entry point for this extension.  We take a list of extensions from the config settings
 * (the *vscode* settings that is) for this extension, written in a subset of the `npm` dependency format (we only accept
 * #semver specifications at the moment).  Each extension specified is then updated according to the listed semver rules
 * (or not if no update is available).
 * @algorithm
 * 
 * Basically, we find the path to where all the extensions are held (afaik, atm there's only one place that vscode looks)...
 * 
 * @notes
 * - I am still a little surprised I have permissions.  Some checking to verify I have permissions would be good.
 * - I don't verify that either `git` or `npm` are installed.
 * @param {object} _context The `context` object as passed into `activate()`
 * @futures
 * - We could accept a commitish specification as well, would be easy.
 */
function updateExtensions(_sExtPath) {
  // And then the extension mechanics...
  //- Find path to the extensions directory
  let extPath = path.join(_sExtPath, "\..");    

  //- Get the collection of extensions we are supposed to manage.
  let config = vscode.workspace.getConfiguration('pvtExtMgr');
  let keepLog = config.get("keepLog");
  let exts = config.get("extensions");

  function promiseToUpdate(_extName) {
    return new Promise((resolve, reject) => {
      try {
        console.log(util.format("start %s", _extName));
        taskState.progressBar.report({ increment: 100 / taskState.count, message: util.format("Updating %s", _extName) });
        // If I fork, I have to communicate across the channel all the relevant data before kicking off the task...
        // This isn't working at all.
        // vscode seems to play some games with node and fork which I'm not spending the time to debug right now.
        // 3221225477 is a windows access violation, typically perms or path issues
        // let update = cp.fork("./updateEx", [], { stdio:  [0, 1, 2, 'ipc'] });
        // let update = cp.fork("updateEx.js", [], { cwd: _sExtPath }); // access violation
        // let update = cp.fork(path.join(_sExtPath, "updateEx.js")); // access violation, cause unknown
        // let update = cp.fork(`${__dirname}/updateEx.js`);   // access violation; because it doesn't exist
        // let update = cp.spawn("node", [ "updateEx.js" ], { cwd: _sExtPath, stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] });
        // let update = cp.spawn("node", [ "updateEx.js" ], { cwd: _sExtPath, stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ] });
        // , encodeURI(_extName), encodeURI(extPath), encodeURI(exts[_extName])
        let update = cp.spawn(util.format("node updateExtension.js %s %s %s %s", encodeURI(_extName), encodeURI(extPath), encodeURI(exts[_extName]), config.get("clean")), { cwd: _sExtPath, stdio: "pipe", shell:true });
        // update.on('message', function(_msg) {
        //   if(_msg === "Ready") {
        //     // update.send()
        //     let n = update.send(_extName);          // name of the extension
        //     update.send("Test");
        //   } else if (_msg === "Alive") {
        //     // console.log("Still alive");
        //     update.send("Yes");
        //   } else {
        //     resolve(_extName);
        //   }
        //   console.log("Ext Received:", _msg);
        // });

        update.on('close', function(_code, _signal) {
          // console.log("update closed.");
        });

        update.on('exit', (_code, _signal) => {
          console.log(util.format("[%s]: Completed.", _extName));
          resolve(_extName);
        });

        update.stdout.on('data', (_data) => {
          console.log(util.format("[%s]: %s", _extName, _data.toString()).trim());
          //if(keepLog) {}
          // process.stdout.write(_data);
        });

        // update.send(extPath);           // 
        // update.send(exts[_extName]);    // semver specifier
      } catch(e) {
        console.log("Ran into an error", e);
        reject(e);
      }
    });
  }

  //#region tabled
  //* We could update these in serially or in parallel
  //- Build communication pipe
  // We going to use this to prevent collision from different vscode instances..
  // let pipeName = util.format("%s.%s", "vscode", "pvtExtMgr");
  // process.env.TASK_PIPE = pipeName;
  // let pipePath = util.format("\\\\.\\pipe\\%s", pipeName);

  // // Setup server
  // taskState.commChannel = net.createServer((_client) => {

  // });

  // let p = new Promise((resolve, reject) => {
  //   taskState.commChannel.listen(pipePath, function() {
  //     console.log("server started...");
  //     resolve();
  //   });

  //   taskState.commChannel.on('error', (e) => {
  //     console.log("Got error on server");
  //     reject(e);
  //   });
  // });
  //#endregion

  // serial setup
  let extNames = Object.getOwnPropertyNames(exts);
  taskState.count = extNames.length + 1;

  // There's probably an easier way to do this than my hand built iterator... 
  function serialize(_idx) {
    return new Promise((resolve, reject) => {
      if(_idx < extNames.length) {
        taskState.current = _idx + 1;
        resolve(promiseToUpdate(extNames[_idx]).then((ext) => {
          console.log(util.format("[%s done so then] : Doing next", ext, _idx+1));
          return serialize(_idx+1);
        }).catch(e => reject(e)));
      } else {
        console.log("End of chain");
        resolve(_idx);
      }
    });
  }

  // return p.then(() => { return serialize(0); });
  
  return serialize(0);
  
  // .then(() => { 
  //   return new Promise(
  //     (resolve, reject) => { 
  //       setTimeout(() => { 
  //         console.log("done"); 
  //         taskState.commChannel.close(); 
  //         resolve(); 
  //       }, 5000);
  //     }
  //   );
  // })

  // parallel
  // let updates = [];

  // for (let extName in exts) {
  //   // We could push these out in groups to prevent overloading/resource crunches
  //   updates.push(promiseToUpdateEx(extName));
  // }

  // return Promise.all(updates);

  // return Promise.all(updates).then((r) => {
  //   taskState.taskComplete();
  // });  
}

function taskComplete() {
  taskState.inProgress = false;
}


function promiseToUpdateEx(_extName) {
  return new Promise((resolve, reject) => {
    console.log(util.format("start %s", _extName));
    taskState.progressBar.report({ increment: 100 / taskState.count, message: util.format("Updating %s", _extName) });
    setTimeout(() => { 
      console.log(util.format("finish %s", _extName));
      resolve(_extName); 
    }, 1000);
  });
}

/**
 * 
 * @param {string} _extName 
 * @deprecated Not using this pattern
 */
function viaEncodedCLI(_extName) {
  return new Promise((resolve, reject) => {
    let updProcess = cp.spawn(util.format("node updateExtension.js %s %s", encodeURI(_extName), encodeURI(extPath), encodeURI(exts[_extName])), { cwd: _context.extensionPath, stdio: "pipe", shell:true });
    updProcess.stdout.on('data', (_data) => {
      // console.log(_data.toString());
      // process.stdout.write(_data);
    });

    updProcess.stderr.on('data', (_data) => {
      console.error(_data.toString());
      // process.stderr.write(_data);
    });

    //- catch completion
    updProcess.on('exit', (_code, _signal) => {
      // vscode.window.showInformationMessage()
      resolve(updProcess);
    });
    updProcess.on('error', (_err) => {
      vscode.window.showErrorMessage(util.format("PvtExtMgr: Error! (%s)", _err.message));
      reject(_err);
    });
  });
}