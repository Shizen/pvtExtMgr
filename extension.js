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
 * @internal
 * @desc 
 * Perhaps I should go against the coding convensions of js coders everywhere and use capitalized var names for local scoped objects...
 * I mean I did in Frontiers.  Anyway, this is the closure-scoped var which holds the manager's state within vscode.
 */
let extState = {};     // closure scoped like a boss :/

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('pvtExtMgr.checkExtensions', function () {
    try {
      if(extState !== undefined) {
        if(extState.inProgress) {
          vscode.window.showErrorMessage("Private Extension Manager: Extension update already in progress.");
          return;
        }
      } else {
        extState = {};
      }

      extState.inProgress = true;
      if(!extState.statusBarItem) {
        extState.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
      }
      extState.statusBarItem.text = "PvtExtMgr: Updating private extensions";
      extState.statusBarItem.show();

      updateExtensions(context);

      extState.statusBarItem.hide();
      extState.statusBarItem = undefined;
      extState.inProgress = false;
    } catch(e) {
      console.error(e.message);
    }
  }));
}
exports.activate = activate;

function deactivate() {
    if(extState.statusBarItem) {
        extState.statusBarItem.hide();
        extState.statusBarItem = undefined;  // tots unnecessary, brah.
    }
    extState = undefined;
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
function updateExtensions(_context) {
  // And then the extension mechanics...
  //- Find path to the extensions directory
  let extPath = _context.extensionPath;
  extPath = path.join(extPath, "\..");    // Again, going to run into posix issues here on non-Windows.  Stupid path module

  //- Get the collection of extensions we are supposed to manage.
  let config = vscode.workspace.getConfiguration('pvtExtMgr');
  let exts = config.get("extensions");

  //- For each extension...
  if(config.get("runAsync")) {
    // This time using js's built in async stuff

    // Promisfy each call 
    async function promiseToUpdate(_extName) {
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

    let updates = [];
    for (let extName in exts) {
      // We could push these out in groups to prevent overloading/resource crunches
      updates.push(promiseToUpdate(extName));
    }

    Promise.all(updates).then((r) => {
      // console.log("all done");
    });
  } else {    // synchronous update
      const update = require('./update.js');
      for (let extName in exts) {
          try {
              // update(extName, extPath, exts[extName], config.get("clean"), vscode);
              update(extName, extPath, exts[extName], vscode);
          } catch(e) {
              vscode.window.showErrorMessage(`PvtExtMgr: Error! "${e.message}"`);
          }
      }
  }
}

