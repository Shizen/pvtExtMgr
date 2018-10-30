

#{ Pre-Release checklist

- branch release and dev, clean/purge release  
  The concept is to have a dev branch which we store on AWS, and a stripped, presentable version on github.  This is kind of a pita, though, if one imagines actually stripping comments by hand every time.  So, really I'd want to strip designated internal comments as mentioned... Because doing a separate clean is rediculous.  Ok.  But I don't have this facility at the moment.  So leave the various comments in?

  //. mumble.  Trouble is I can't easily ctrl-/ such things.  I could strip all non // comments, but that seems "bad".  Basically I want a comment vs. an ignore.
  I can implement this by basically saying, ctrl-/ will insert `///` instead of `//` and `///` is ignore.  I could instead try to alter my patterns and reserve `//` for ignore and `/* */` for comments, but I think this is probably unwise.

  Ideally, tools like `git` would also *ignore* ignore-lines, so a file with differing `///` would still be considered the same, so long as everything else was the same--so I could have my `///` and someone else could have their own `///` comments.  The merge/move/floating aspects would be rough.  bother.

}

#{ ToDo

- Convert my `execSync` calls to async calls and leverage gitExecSync.  Each individual extension test can be "forked" in its own async process, but within a process, it's easier to use gitExecFauxSync, or whatever I'm calling it.  That is probably in grunt build tasks, which tells me that I probably want to move it out into a more generic lib.  Even grunt-utils turns out to be too narrow in naming.  I should probably fix that.
- debounce
- reload extensions (in all open vscode instances) -- A little controversial.  I'd have to open a second named pipe to communicate between my various extensions in each vscode instance, which feels a bit like using napalm to swat a fly, but...  It *would* work.  Also would require that this extension always be active in every vscode instance.
- Validation & Robustness
  - validate that `git` and `npm` are installed/in path
  - verify that the extension in question is an npm module under git.
  - security and access perms

Features

- allow commitish format (e.g. #master)
- could set up a communication channel between the various workers and myself, but that seems like overkill.  It *would* allow me to "easily" relay update information from the various threads to the main.  Also using a named pipe would allow debouncing between vscode instances.

}

#{ Links

- [semver](https://www.npmjs.com/package/semver)
- [semver-extra](https://www.npmjs.com/package/semver-extra)

}

# Private Extension Manager

The idea behind this vscode extension is to allow for the management and automatic updating of vscode extensions from one or more private github servers.  To this end, I would have a setting in the extension which would look similar to a package's dependency list (in format), utilizing the github format.  Ideally I'd use the exact same semver math and code as npmm, utilizing the same tagging semantics for githubs in pulling the extensions.

## Design Decisions and Debates

### Extension format

I could walk all the extensions and look for ones which are not public, but that's invasive and fragile.  Instead, I'm explicitly only managing extensions which have entries in my settings.  For these, I am taking their path/info from what is entered in my settings.  I *could* look for the source information from the `repository` field in the appropriate `package.json`, but I'm not going to.  Not even as a fallback.  I think.

### Prereleases

So, I didn't really think about this before, but `semver` does not deal with prerelease versions.  This shouldn't surprise me because of what semver is designed to do and the definition of what it means to be a prerelease version.  Of course, *I* actually want to use prerelease versions of my own extensions.  Or, at least, sometimes I do.  I think.  I'm not really sure that's true though.  I suspect that if I was honest, I would recognize that this is a case where I should just do release versions of my extensions that I wanted released.  But... that's not convenient for me at this moment.

So, let's say, for sake of argument that I want to support auto grabbing and installing prerelease versions, which the more I think about it, the less I think that's wise, but whatever.  Maybe I will only allow it from a specific command extension, but then I'd not want to do it for all extensions I suspect.  Which is exactly where I was going--how do I want to architect it then?  

Apriori we have recognized that most of the time we don't want to use this behavior.  I think it is also clear that we don't to exercise this behavior in a blanket methodology for all the extensions we're managing.  So it needs to be a setting of some sort that we specify for a specific module/extension on a case by case behavior.  The simplest method I can think of is to use an alternate of `#semver:`... like `#semver-prerelease:`.  That means we'd have to set it in the settings, and not be all.. just do it this one time.  I think if I was going to do it as a one-time thing I'd want to execute a command that would let me pick an extension that exists (or maybe enter/pick one) and then enter a custom semver line.  Not necessary for the moment, and requires like.. UI, which I haven't looked at doing in vscode yet.  I digress.

## URL

For compliance, consistancy type considerations, I'm using Node's [url parser](https://nodejs.org/docs/latest-v8.x/api/url.html#url_class_url) to parse setting entries.  All good so far, but may introduce issues later.

-----

# Dev log

- Ran into an interesting problem with `deasync` and `node-gyp`.  Apparently for some reason, my extension is not building its native extension support code.  This appears to be a "bug" in vscode, in that it's looking for `.node` files in the wrong directory from where `deasync` as put them and deasync is the *first*?!? gypped/native module I've used?!?  Which is possible.  
  So some research shows me that vscode (which recall is built on electron), uses the `node-bindings` module to search for "native" node-gypped `.node` files.  This module checks in a bunch of places, none of which are where `deasync` puts its gypped files.  More research is required. 
