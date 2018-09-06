// jshint esversion: 6

/**
 * @module pvtExtMgr
 * Private Extension Manager
 * @desc
 * This is a "simple" little extension which leverages `npm`'s `semver` module (and `semver-extra` ;) ) to allow for
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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
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
 * @algorithm
 * Basically, we find the path to where all the extensions are held (afaik, atm there's only one place that vscode looks)...
 * @notes
 * - I am still a little surprised I have permissions.  Some checking to verify I have permissions would be good.
 * - I don't verify that either `git` or `npm` are installed.
 * @param {object} _context The `context` object as passed into `activate()`
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
    // This time using node's built in async stuff

    // Promisfy each call 

    // updateAsync().then();
    const util = require('util');
    const fs = require('fs');

    const stat = util.promisify(fs.stat);

    async function callStat() {
      const stats = await stat('.');
      console.log(`This directory is owned by ${stats.uid}`);
      return stats.uid;
    }

    console.log("Async 'launched'");

    callStat().then((r) => {
      console.log("Async done.");
    });

    async function makeTheCall(_extName) {
      return new Promise((resolve, reject) => {
        let updProcess = cp.spawn(util.format("node updateExtension.js %s %s", encodeURI(_extName), encodeURI(extPath), encodeURI(exts[_extName])), { cwd: _context.extensionPath, stdio: "pipe", shell:true });
        updProcess.stdout.on('data', (_data) => {
          console.log(_data.toString());
          // process.stdout.write(_data);
          // self.out.push(_data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''));  // stripping control characters
        });
      
        updProcess.stderr.on('data', (_data) => {
          console.error(_data.toString());
          // process.stderr.write(_data);
        });

        //- catch completion
        updProcess.on('exit', (_code, _signal) => {
          updProcess.exitCode = _code;
          updProcess.signal = _signal;
          resolve(updProcess);
          // updProcess.complete = true; // redundent I think
          // vscode.window.showInformationMessage()
        });
        updProcess.on('error', (_err) => {
          updProcess.error = _err;
          updProcess.exitCode = _err.status;
          // updProcess.complete = true;
          vscode.window.showErrorMessage(util.format("PvtExtMgr: Error! (%s)", _err.message));
          reject(_err);
        });
      });
    }

    let updates = [];
    for (let extName in exts) {
      updates.push(makeTheCall(extName));
    }

    Promise.all(updates).then((r) => {
      console.log("all done");
    });
      //#region deasync method
      // let updates = [];
      // for (let extName in exts) {
      //     //- kick off update
      //     // I need extPath and extName
      //     //?Do I really want to ignore its output?
      //     // encodeURI to ignore all those pesky cli issues
      //     let updProcess = cp.spawn(util.format("node updateExtension.js %s %s", encodeURI(extName), encodeURI(extPath), encodeURI(exts[extName])), { cwd: _context.extensionPath, stdio: "pipe", shell:true });
      //     //- push the cp into my updates collection
      //     updates.push(updProcess);
          
      //     updProcess.stdout.on('data', (_data) => {
      //         console.log(_data.toString());
      //         // process.stdout.write(_data);
      //         // self.out.push(_data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''));  // stripping control characters
      //     });
        
      //     updProcess.stderr.on('data', (_data) => {
      //         console.error(_data.toString());
      //         // process.stderr.write(_data);
      //     });

      //     //- catch completion
      //     updProcess.on('exit', (_code, _signal) => {
      //         updProcess.exitCode = _code;
      //         updProcess.signal = _signal;
      //         updProcess.complete = true; // redundent I think
      //         // vscode.window.showInformationMessage()
      //     });
      //     updProcess.on('error', (_err) => {
      //         updProcess.error = _err;
      //         updProcess.exitCode = _err.status;
      //         updProcess.complete = true;
      //         vscode.window.showErrorMessage(util.format("PvtExtMgr: Error! (%s)", _err.message));
      //     });

      // }
      // // use deasync to wait until all of the cp have returned
      // // It's like parallel, y'all!
      // require('deasync').loopWhile(function(){
      //     return updates.reduce((_acc, _cur) => {
      //         return _acc && _cur.complete;
      //     }, true);
      // });

      // // do whatever clean up/notification I might need (none atm)
      // console.log("I think I'm done", updates);
      //#endregion
  } else {    // synchronous update
      const update = require('./update.js');
      for (let extName in exts) {
          try {
              update(extName, extPath, exts[extName], vscode);
          } catch(e) {
              vscode.window.showErrorMessage(`PvtExtMgr: Error! "${e.message}"`);
          }
      }
  }
}

