
Pre-Release checklist

- Verify that updates still work with all the refactoring, and that the user is notified when an extension is updated (sanity check)
  - No
- Double check that npm modules actually do track versions by tags :/.
- Check if we can manually trigger a window reload
- branch release and dev, clean/purge release

# pvtExtMgr (Private Extension Manager)

The purpose of this extension is to allow you to setup and maintain extensions for your vscode installation which are automatically kept up to date with a "private" git server.  To this end, this module follows the same pattern as `npm` for specifying and tracking versions of npm modules.  This module allows the user to specify in this module's settings a `dependencies`-like list of `#semver` npm references to a git server and semver version specification for the desired version of the extension they would like to have installed.  The primary goal is to support user developed and private extensions in vscode.

## Features

- Add an extension with a git + semver rule to your settings for this extension to have `pvtExtMgr` automatically check that repos for the latest matching version of that extension upon command.
- I could pretty print my dates more
- Could put in more detailed progress bar status updates

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

- Need to improve error handling & reporting, especially in async mode.
- Does not verify that the user has permissions to update the extension(s) in question.  To be clear, here I mean perms to modify the local file system.
- This module does not debounce for multiple instances.  By which I mean that it does not deal gracefully with the situation where a user has multiple instances of vscode open and executes an update from each of them at "the same time".
- When a new version of an extension is loaded, it does not, particularly trigger reloading of that extension in vscode.  Mostly because it's not clear how to get vscode to reload extensions which have already been activated.  Inactive extensions shouldn't need to be reloaded.
  - See also [this Issue](https://github.com/Microsoft/vscode/issues/31712).
- This module has not been tested on the Mac or Linux (I don't have either setup atm).  Pathing may be dorked on such platforms.
- I have done no testing for any of the myriad of git security/setups that might be in place.  I use `ssh` with installed keys.
- Not tested with older versions of npm (only tested with npm 6).
- Although the code is in place, this module will never execute a `git clean` which is probably wrong.

## Futures

- It would be easy to add support for the "commitish" format as well.
- In async mode, grouping update requests to throttle resource strangling might be nice, if someone ended up "abusing" this extension
- Settings to allow one to specify a specific git or npm client to use.
  - Support for custom credentials by extension
- Support to allow the user to trigger an update/check for a specific

## Release Notes

- 0.0.2 : Initial Release