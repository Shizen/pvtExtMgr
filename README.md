# pvtExtMgr (Private Extension Manager)

The purpose of this extension is to allow you to setup and maintain extensions for your vscode installation which are automatically kept up to date with a "private" git server.  

## Features

- Add an extension with a git + semver rule to your settings for this extension to have `pvtExtMgr` automatically check that repos for the latest matching version of that extension upon command.

## Requirements

This extension requires that the user already have `git` and `npm` installed and included in their path.

## Extension Settings

`pvtExtMgr.extensions`
:   This is the most important setting for this extension.  This setting lists which extensions you want `pvtExtMgr` to update for you and via which rule.  This setting uses a subset of the `npm` `dependency` format--it will only accept `#semver` rules.  Any other format will be ignored.
  
    "pvtExtMgr.extensions": {
      "jsdoc-view": "git+ssh://git@127.0.0.1:/srv/git/jsdoc-view.git#semver:prerelease",
      "shinmark": "git+ssh://git@127.0.0.1:/srv/git/shinmark.git#semver:latest",
      "pvtExtMgr": "git+ssh://git@127.0.0.1:/srv/git/vscExt-pvtExtMgr.git#semver:~0.0.2"
    }

This setting does extend the `#semver` format to add `prerelease` and `latest` as options.  `latest` will follow the standard `dependencies` definition for versioning.  `prerelease` will take the latest version, including prereleases.  These maths are provided courtesy of the `semver-extra` module.

`pvtExtMgr.runAsync`
:   If set to true, `pvtExtMgr` will run its extension update tests asynchronously on a number of worker threads and notify you when it is complete.


## Known Issues

- Does not verify that the user has permissions to update the extension(s) in question.
- This module has not been tested on the Mac or Linux (I don't have either setup atm).  Pathing may be dorked on such platforms.
- I have done no testing for any of the myriad of git security/setups that might be in place.  I use `ssh` with installed keys.
- Not tested with older versions of npm (only tested with npm 6).

## Futures

- It would be easy to add support for the "commitish" format as well.
- In async mode, grouping update requests to throttle resource strangling might be nice, if someone ended up "abusing" this extension
- Settings to allow one to specify a specific git or npm client to use.
  - Support for custom credentials by extension

## Release Notes

- 0.0.2 : Initial Release