# release-semver
Create a release using semver

# one branch setup
- yarn release-semver --sourceBranch release --commands [tag,push]
Check if your local git copy is clean and up to speed, tag the branch.

# master (development) and release (stable) branch setup
- yarn release-semver
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
