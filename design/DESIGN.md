
#{ ToDo

- Assuming the above two tests work, I need documentation and testing.  Top of the list is security issues, because, like.. we're not doing anything there.
- Convert my `execSync` calls to async calls and leverage gitExecSync.  Each individual extension test can be "forked" in its own async process, but within a process, it's easier to use gitExecFauxSync, or whatever I'm calling it.  That is probably in grunt build tasks, which tells me that I probably want to move it out into a more generic lib.  Even grunt-utils turns out to be too narrow in naming.  I should probably fix that.
- debounce
- feedback that update is in progress
- reload extensions (in all open vscode instances)
- validate that `git` and `npm` are installed/in path
  - verify that the extension in question is an npm module under git.

Features

- allow commitish format (e.g. #master)
- could set up a communication channel between the various workers and myself, but that seems like overkill.  It *would* allow me to "easily" relay update information from the various threads to the main.

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