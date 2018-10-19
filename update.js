/**
 * @file The `udpate.js` is where the majority of the code for this extension lives.
 * This file is structured as a module so as to allow the extension to consume it how
 * it likes based on whether it is executing in syncronous or asyncronous mode.
 * @author Shin <shin@shinworks.co>
 */

// jshint esversion:6

/**
 * @module update
 * @desc
 * I hesitate to list this as its own module, but technically, that's the way it is defined.
 * `update` implements the core update features for the private extension update manager.
 * This module exports a single function which is the `update` function.  The function takes
 * the information necessary to test the semver information and potentially update one (and only
 * one) extension.  This function is called multiple times by the `pvtExtMgr` to update all the
 * extensions on its list.
 * @param {string} _sExtName The name of the extension (required to match the folder name, which
 * btw, means that private extensions will not use the version appended naming pattern of public
 * extensions, which at least makes the distinction quite clear).
 * @param {string} _sExtPath Fully qualified path to where vscode keeps its extensions (or where
 * you want the update module to look for extensions, at least).
 * @param {string} _sSource The information on the git server from which you wish to acquire new
 * versions of the extension in question.
 * @param {object} _vscode [Optional] If present, indicates that this function is running on the
 * server/render thread and can make direct calls back to vscode in order to provide feedback.
 */
module.exports = function(_sExtName, _sExtPath, _sSource, _vscode) {
  const fs = require('fs');
  const path = require('path');
  const semver = require('semver');
  const semverPre = require('semver-extra');
  const cp = require('child_process');
  const url = require('url');
  const util = require('util');

  let sPath = path.join(_sExtPath, _sExtName);
  // emitFeedback(util.format("update started..."));
  if(fs.existsSync(sPath) && fs.statSync(sPath).isDirectory()) {
    // emitFeedback(util.format("extension exists..."));
    // Other validation?
    //- it has a package.json
    //- it is being tracked by git

    // let desiredVersion = exts[_sExtName];
    let sourceParsed = parseSourceLocVer(_sSource);

    // Figure out which is installed.
    let currentVersion = cp.execSync("git tag --points-at HEAD", { cwd: sPath });
    currentVersion = currentVersion.toString().trim();  //! Need Error checking.
    let availableVersions = getAvailableVersions(sourceParsed, sPath);
    let avail = [];
    availableVersions.map((line) => {
      let p = line.split("\t");
      p = p[p.length-1];
      p = p.match(/refs\/tags\/(.+)\^\{\}/);
      // if(/refs\/tags\/.+\^\{\}/.test(p)) {      // Why bother to test at this point?
      if(p !== null && p.length > 1) {
        avail.push(p[1]);
      }
    });

    if(sourceParsed.semver) {
      // emitFeedback(util.format("checking semver..."));
      let bestAvailableVersion;
      if(sourceParsed.semver === "latest") {
        bestAvailableVersion = semverPre.maxStable(avail);   // I think this works
      } else if (sourceParsed.semver === "prerelease") {
        bestAvailableVersion = semverPre.max(avail);
      } else {
        bestAvailableVersion = semver.maxSatisfying(avail, sourceParsed.semver);
      }

      if(currentVersion !== bestAvailableVersion && bestAvailableVersion !== null) {
        // We need to update
        emitFeedback(util.format("`%s` needs updating... (%s)", _sExtName, bestAvailableVersion), 2, undefined);
        // vscode.window.showInformationMessage(util.format("`%s` needs updating... (%s)", _sExtName, d));
        try {
          updateExtension(sPath, sourceParsed, bestAvailableVersion);
          emitFeedback(util.format("%s update to %s.", _sExtName, bestAvailableVersion), 1, undefined);
        } catch(e) {
          emitFeedback(util.format("An error occured while updating %s.", _sExtName), 1, e);
        }
      } else {
        if(bestAvailableVersion === null) {
          emitFeedback("", 1, { message: util.format("`%s` does not have any matching version in the indicated repository (%s)", _sExtName, sourceParsed.semver) });
          // vscode.window.showErrorMessage(util.format("`%s` does not have any matching version in the indicated repository (%s)", _sExtName, sourceParsed.semver));
        } else {
          // up to date, or none available, which maybe should be handled differently?
          emitFeedback(util.format("`%s` up to date.", _sExtName), 1);
          // vscode.window.showInformationMessage(util.format("`%s` up to date.", _sExtName));
        }
      }
    } else {
      // Do I even allow a non-semver tagged entry?
    }
  } else {
    emitFeedback("Extension not found.", 1);
  }
  
  /**
   * @desc
   * This function will parse the provided string as a URL, returning an object describing its various
   * components including any specified semver specification.
   * @notes
   * This function currently uses `url.parse` to do the basic parsing of the provided string, and will
   * allow any exceptions thrown by that function to pass through to the caller.
   * @param {string} _desiredVersion The source string to parse
   * @returns {object} An object describing the url to the source along with any semver specification.
   */
  function parseSourceLocVer(_desiredVersion) {
    let parsed = {};

    // git+ssh://git@34.214.193.247:/srv/git/shinmarkVscExt.git#master

    // this is basically a url parse...

    parsed = url.parse(_desiredVersion);
    if(parsed.hash) {
      parsed.hash = decodeURI(parsed.hash);
      // if(/#semver:/.test(parsed.hash)) {
        let m = parsed.hash.match(/#semver:(.+)/);
        // parsed.semverScheme = "semver";
        parsed.semver = m !== null? m[1] : undefined;
      // } else if (/#semver-prerelease:/.test(parsed.hash)) {
      //     let m = parsed.hash.match(/#semver-prerelease:(.+)/);
      //     parsed.semverScheme = "semver-prerelease";
      //     parsed.semver = m !== null? m[1] : undefined;
      // }
    }

    return parsed;
  }

  /**
   * @desc 
   * This function will survey the specified remote repos for available versions, which it returns as an
   * array of version strings.  Versions are assumed to be stored as tags (lightweight or annotated).  This
   * function *does not* attempt to filter, validate or disambiguate these tags.
   * @remarks
   * - Currently ignoring branch specification (e.g. no commitish support)
   * - We may need the path to grab git credentials.  If so, I should really isolate any git related code and
   * route requests through them.
   * @param {object} _parsedDesiredVersion A parsed url object
   * @param {string} _sPath The fully qualified path to the extension's directory
   * @returns {array} An array of tags, including version strings defined on the specified repos.  This list is
   * not filtered.
   */
  function getAvailableVersions(_parsedDesiredVersion, _sPath) {
    //git ls-remote --tags
    let versions = cp.execSync(util.format("git ls-remote --tags %s@%s:%s", _parsedDesiredVersion.auth, _parsedDesiredVersion.host, _parsedDesiredVersion.path), { cwd: _sPath });
    let vers = versions.toString().split("\n");     // just to make lint happy
    if(vers.length > 0) {
      vers.splice(vers.length-1);
    }
    return vers;
  }

  /**
   * @desc
   * This is the function which performs the actual update.  This is done via a series execSync calls to `git`
   * and `npm`.
   * @param {string} _sPath The full qualified path to the extension's directory.
   * @param {object} _oParsedRef The parsed url.
   * @param {string} _sTag The version to grab from the repos (assumed to exist).
   * @param {boolean} _bClean If true, will cause this function to run a `git clean -f` on the extension.
   * @futures
   * - This should probably be updated to use the fauxExecSync and quietGitExec utility functions, but for the
   * `deasync` issue.  @see DESIGN.md
   */
  function updateExtension(_sPath, _oParsedRef, _sTag, _bClean) {
    let out = cp.execSync(util.format("git fetch --tags %s@%s:%s", _oParsedRef.auth, _oParsedRef.host, _oParsedRef.path), { cwd: _sPath });
    console.log(util.format("git fetch: %s", out.toString()));
    out = cp.execSync(util.format("git checkout %s", _sTag), { cwd: _sPath });
    console.log(util.format("git checkout: %s", out.toString()));
    if(_bClean) {
      out = cp.execSync(util.format("git clean -f"), { cwd: _sPath });    // I should be able to -f
      console.log(util.format("git clean: %s", out.toString()));
    }
    //! And we need to possibly trigger the correct node-gyp scenario
    out = cp.execSync(util.format("npm install --depth 8"), { cwd: _sPath });               // Modern npm will auto-prune.  Do I want to check for older versions?
    // There may be some node-gyp issues
  }

  /**
   * @desc
   * This function encapsulates the feedback channel for `update` to its caller.  If this module
   * is being run from the render ui/extension thread, then `emitFeedback` will send notifications
   * directly to vscode & the user.  Otherwise it will send messages to its parent via `stdout` 
   * and `stderr`.
   * @param {string} _sMessage The message to emit
   * @param {number} _level The conceptual "warn level" of the feedback.  `1` is a "finalizer" message.  `4` are warnings.
   * @param {object} _oError [Optional] The error object (if any)
   * @futures I could add a log option here, particularly for the in proc scenario (I might log
   * out of proc by capturing & logging the consoles).
   */
  function emitFeedback(_sMessage, _level, _oError) {
    if(_vscode) {
      // I'm running "in proc", so I can message directly
      if(_oError) {
        _vscode.window.showErrorMessage(_oError.message);
      } else {
        _vscode.window.showInformationMessage(_sMessage);
      }
    } else {
      // I'm in a child process.
      if(_oError) {
        console.error(util.format("[%s]:%s", _sExtName, _oError.message));
      } else {
        console.log(util.format("[%s]:%s", _sExtName, _sMessage));
      }
    }
  }
};

