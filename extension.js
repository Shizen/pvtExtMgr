/**
 * @file The `extension.js` file is the base hook-in file for a vscode extension.
 * @author Shin <shin@shinworks.co>
 */

// jshint esversion: 6

/**
 * @module pvtExtMgr
 * @public
 * @desc
 * # Private Extension Manager
 * 
 * This vscode extension facilitates the use/maintenance of private extensions in vscode.  This module leverages 
 * `npm`'s [`semver`](https://www.npmjs.com/package/semver) module (and [`semver-extra`](https://www.npmjs.com/package/semver-extra))
 * to allow for tracking and auto-updating of vscode extensions from private git repos using semver maths.
 * 
 * For purposes of *this* module, tracking is done not via the actual contents of a module's `package.json`, but
 * rather by the tags on its git repository (e.g. by version tag ala `npm version`).  
 * @algorithm
 * The name of the extension is assumed to match the folder the extension is located in within vscode's `extensions` 
 * directory.  
 * 
 * Updating an extension involves...
 * 1. pulling the extension from its git repos (by tag; technically this is currently fetched then checked out)
 * 2. if (clean) is set, git clean -f
 * 3. npm install
 */
let m;  // hax to trick vscode's intellisense


/**
 * @const {object} vscode visual studio codes's built in api object.
 * @private
 */
const vscode = require('vscode');
/**
 * @const {object} path `nodejs`'s built-in path module. 
 * @private
 */
const path = require('path');
/**
 * @const {object} cp `nodejs`'s built-in child_process module.
 * @private
 */
const cp = require('child_process');
/**
 * @private
 * @const {object} util `nodejs`'s built-in util module.
 */
const util = require('util');
/**
 * @private
 * @const {object} net `nodejs`'s built-in net module.
 */
const net = require('net');
/**
 * @private
 * @const {object} fs `nodejs`'s built-in fs module.
 */
const fs = require('fs');

/**
 * @protected
 * @desc 
 * Perhaps I should go against the coding convensions of js coders everywhere and use capitalized var names for local scoped objects...
 * I mean I did in Frontiers.  Anyway, this is the closure-scoped var which holds the manager's state within vscode.
 */
let taskState = { taskComplete: taskComplete};     // closure scoped like a boss :/

/**
 * @protected
 * @desc
 * The activation event hook for this extension.  See vscode documentation for more details.  For this extension, its `activate()`
 * function only registers commands.
 * 
 * @registerCommand pvtExtMgr.checkExtensions The workhorse command of this extension.
 * @param {object} context 
 */
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
            // cancel 
            taskState.taskComplete();
            console.log("Cancelled by user request");
            reject({ message: "Cancelled by user request" });
          });
          taskState.progressBar = _oProgress;
          return updateExtensions(context.extensionPath).then((updated) => {
            taskState.taskComplete();
            if(updated) {
              vscode.window.showInformationMessage("One or more extensions have been updated", "Reload", "Cancel").then((resp) => {
                vscode.window.showInformationMessage(util.format("Inception!! %s", resp));
                if(resp === "Reload") {
                  // reload extensions
                  vscode.commands.executeCommand("workbench.action.reloadWindow");
                }
              });
            }
            resolve(updated);
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

/**
 * @protected
 * @desc
 * Basic deactivation tasks for this extension.
 */
function deactivate() {
    taskState = undefined;
}
exports.deactivate = deactivate;




/**
 * @protected
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
 * - This function should probably live on the task object itself.
 */
function updateExtensions(_sExtPath) {
  // And then the extension mechanics...
  //- Find path to the extensions directory
  let extPath = path.join(_sExtPath, "\..");    

  //- Get the collection of extensions we are supposed to manage.
  let config = vscode.workspace.getConfiguration('pvtExtMgr');
  let keepLog = config.get("keepLog");
  let log;

  if(keepLog) {
    try {
      // Create a log file, or open the same one in case they are just running this back to back
      let d = new Date(Date.now());
      let fn = util.format("ext-updates~%s'%s %s-%s-%s.log", d.getHours(), d.getMinutes(), d.getMonth() + 1, d.getDate(), d.getFullYear());
      console.log(fn);
      log = fs.createWriteStream(path.join(_sExtPath, fn), { flags: 'a', autoClose: true });
      log.write(util.format("Private Extensions update started %s:%s on %s-%s-%s\n", d.getHours(), d.getMinutes(), d.getMonth()+1, d.getDate(), d.getFullYear()));
      // log.on('finish', function() {
      //   console.log("log: Got finished");
      // });
      // log.on('error', function(e) {
      //   console.log("log: Error", e);
      // });
      // log.on('close', function() {
      //   console.log("log: Close");
      // });
    } catch(e) {
      let msg = vscode.window.showErrorMessage("[pvtExtMgr]: Could not create log file...", e.message);
      // msg.then() // Ask to continue? -- I don't like showInputBox or quickPick for these, neither is a basic dialog.
      return new Promise((resolve, reject) => { reject(e); });
    }
  }

  let exts = config.get("extensions");

  function promiseToUpdate(_extName) {
    return new Promise((resolve, reject) => {
      try {
        // console.log(util.format("start %s", _extName));
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

        update.on('exit', (_code) => {
          // console.log(util.format("[%s]: Completed.", _extName));
          if(keepLog) {
            log.write(util.format("[%s]: Completed.\n", _extName));
          }
          resolve(_code === -1? true : false);
        });

        update.stdout.on('data', (_data) => {
          // console.log(util.format("[%s]: %s", _extName, _data.toString()).trim());
          if(keepLog) {
            // Interesting that someone is eating my \n here, but not in the above exit log message.
            // I should maybe encapsulate log writes too
            log.write(util.format("[%s]: %s\n", _extName, _data.toString()).trim());
            log.write("\n");
          }
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

  // serial setup
  let extNames = Object.getOwnPropertyNames(exts);
  taskState.count = extNames.length + 1;

  // There's probably an easier way to do this than my hand built iterator... 
  function serialize(_idx, _updAggregate) {
    return new Promise((resolve, reject) => {
      if(taskState.inProgress !== true) {
        reject({ message: "Task no longer in progress" });
      } else {
        if(_idx < extNames.length) {
          taskState.current = _idx + 1;
          resolve(promiseToUpdate(extNames[_idx]).then((updated) => {
            if(updated) {
              console.log("%s was updated.", extNames[_idx]);
            }
            // console.log(util.format("[%s done so then] : Doing next (idx:%s)", ext, _idx+1));
            let d = Date.now();
            while(Date.now()-d < 1000) {
              // Do nothing.  We're waiting.
            }
            return serialize(_idx+1, updated || _updAggregate);
          }).catch(e => reject(e)));
        } else {
          console.log("End of chain");
          if(keepLog) {
            let d = new Date(Date.now());  
            // console.log(util.format("Private Extensions update completed %s:%s on %s-%s-%s\n", d.getHours(), d.getMinutes(), d.getMonth()+1, d.getDate(), d.getFullYear()));        
            log.end(util.format("Private Extensions update completed %s:%s on %s-%s-%s\n", d.getHours(), d.getMinutes(), d.getMonth()+1, d.getDate(), d.getFullYear()));
            // log.end();
            // log.close();
          }
          resolve(_updAggregate);
        }
      }
    });
  }
  
  return serialize(0, false);

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

/**
 * Internally, this function is called to signal a given task is complete.  
 * @protected
 */
function taskComplete() {
  taskState.inProgress = false;
}
