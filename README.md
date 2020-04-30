# release-semver
Create a release using semver

# one branch setup
```
yarn release-semver --sourceBranch release --commands [tag,push]
```
Check if your local git copy is clean and up to speed, tag the branch.

# master (development) and release (stable) branch setup
```
yarn release-semver
```
Check if your local git copy is clean and up to speed, check if master contains all commits of release branch, merge master into release and tag the release branch.

# options
```
const options = {
        sourceBranch: 'master', # the branch of which your are creating a release
        targetBranch: 'release', # the branch into which `sourceBranch` is merged
        upstream: 'origin', # the remote to use
        prefix: false, # if you wish to use a prefix in your tags
        silent: true, # if you wish to see all the git command noise
        verbose: false # if you whish to see all the noise this package makes 
    };
```

# example
```
hielkehoeve@bookbook % yarn release-semver --prefix release
yarn run v1.22.4
$ release-semver --prefix release
release-semver v1.0.0 running
✔ Working dir is clean.
✔ Repo updated.
✔ Source branch 'master' found.
✔ Target branch 'release' found.
✔ Source branch 'master' has upstream 'origin'.
✔ Target branch 'release' has upstream 'origin'.
✔ Branches synchronized
✔ Everything is uptodate.
✔ Latest version is 1.0.0.
? Select the new version: minor version (e.g. new functionality, no breaking changes): 2.0.0
✔ Merged master into release
✔ Release tagged.
✔ Things got pushed. We're done. 🎉🎉🎉
✨  Done in 5.95s.
```

```
hielkehoeve@bookbook % yarn release-semver --sourceBranch release --prefix release --commands [tag,push]
yarn run v1.22.4
$ release-semver --sourceBranch release --prefix release --commands [tag,push]
release-semver v1.0.0 running
✔ Working dir is clean.
✔ Repo updated.
✔ Source branch 'release' found.
✔ Source branch 'release' has upstream 'origin'.
✔ Branches synchronized
✔ Latest version is 2.0.0.
? Select the new version: patch version (e.g. bug fixes): 2.0.1
✔ Release tagged.
✔ Things got pushed. We're done. 🎉🎉🎉
✨  Done in 4.61s.
```
