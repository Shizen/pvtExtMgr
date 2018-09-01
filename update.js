
// jshint esversion:6


module.exports = function(_sExtName, _sExtPath, _sSource, _vscode) {
  const fs = require('fs');
  const path = require('path');
  const semver = require('semver');
  const semverPre = require('semver-extra');
  const cp = require('child_process');
  const url = require('url');
  const util = require('util');

  let sPath = path.join(_sExtPath, _sExtName);
  emitFeedback(util.format("update started..."));
  if(fs.existsSync(sPath) && fs.statSync(sPath).isDirectory()) {
    emitFeedback(util.format("extension exists..."));
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
      emitFeedback(util.format("checking semver..."));
      let d;
      if(sourceParsed.semver === "latest") {
        d = semverPre.maxStable(avail);   // I think this works
      } else if (sourceParsed.semver === "prerelease") {
        d = semverPre.max(avail);
      } else {
        d = semver.maxSatisfying(avail, sourceParsed.semver);
      }

      if(currentVersion !== d && d !== null) {
        // We need to update
        emitFeedback(util.format("`%s` needs updating... (%s)", _sExtName, d));
        // vscode.window.showInformationMessage(util.format("`%s` needs updating... (%s)", _sExtName, d));
        updateExtension(sPath, sourceParsed, d);
      } else {
        if(d === null) {
          emitFeedback("", { message: util.format("`%s` does not have any matching version in the indicated repository (%s)", _sExtName, sourceParsed.semver) });
          // vscode.window.showErrorMessage(util.format("`%s` does not have any matching version in the indicated repository (%s)", _sExtName, sourceParsed.semver));
        } else {
          // up to date, or none available, which maybe should be handled differently?
          emitFeedback(util.format("`%s` up to date.", _sExtName));
          // vscode.window.showInformationMessage(util.format("`%s` up to date.", _sExtName));
        }
      }
    } else {
      // Do I even allow a non-semver tagged entry?
    }
  } else {
    emitFeedback("Extension not found.");
  }
  
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

  // We may need the path to grab git credentials
  // Currently ignoring branch specification
  function getAvailableVersions(_parsedDesiredVersion, _sPath) {
    //git ls-remote --tags
    let versions = cp.execSync(util.format("git ls-remote --tags %s@%s:%s", _parsedDesiredVersion.auth, _parsedDesiredVersion.host, _parsedDesiredVersion.path), { cwd: _sPath });
    let vers = versions.toString().split("\n");     // just to make lint happy
    if(vers.length > 0) {
      vers.splice(vers.length-1);
    }
    return vers;
  }

  function updateExtension(_sPath, _oParsedRef, _sTag) {
    let out = cp.execSync(util.format("git fetch --tags %s@%s:%s", _oParsedRef.auth, _oParsedRef.host, _oParsedRef.path), { cwd: _sPath });
    console.log(util.format("git fetch: %s", out.toString()));
    cp.execSync(util.format("git checkout %s", _sTag), { cwd: _sPath });    // I should be able to -f
    console.log(util.format("git checkout: %s", out.toString()));
    cp.execSync(util.format("npm install"), { cwd: _sPath });               // Modern npm will auto-prune.  Do I want to check for older versions?
  }

  function emitFeedback(_sMessage, _oError) {
    if(_vscode) {
      if(_oError) {
        _vscode.window.showErrorMessage(_oError.message);
      } else {
        _vscode.window.showInformationMessage(_sMessage);
      }
    } else {
      if(_oError) {
        console.error(util.format("[%s]:%s", _sExtName, _oError.message));
      } else {
        console.log(util.format("[%s]:%s", _sExtName, _sMessage));
      }
    }
  }
};

