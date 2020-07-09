#!/usr/bin/env node
const shell = require("shelljs");

const {
  getOptions,
  welcome,
  gitOrQuit,
  currentBranch,
  checkoutBranch,
  cleanWorkdir,
  updateRepo,
  sourceBranchCheck,
  targetBranchCheck,
  sourceUpstreamCheck,
  targetUpstreamCheck,
  fastForwardAll,
  uptodateCheck,
  latestVersion,
  incrementVersion,
  merge,
  tag,
  push
} = require("./functions.js");

const script = async () => {
  const options = getOptions();
  shell.config.silent = options.silent;
  shell.config.verbose = options.verbose || options.dryrun;
  welcome(options);
  gitOrQuit();
  const branch = currentBranch();
  cleanWorkdir(options);
  updateRepo(options);
  sourceBranchCheck(options);
  targetBranchCheck(options);
  sourceUpstreamCheck(options);
  targetUpstreamCheck(options);
  fastForwardAll(options);
  uptodateCheck(options);

  const currentVersion = latestVersion(options);
  const newVersion = await incrementVersion(currentVersion || "0.0.0");
  if (newVersion) {
    //update version in package.json ?
    //if so, do commit

    merge(newVersion, options);
    tag(newVersion, options);
    push(newVersion, options);
  }
  checkoutBranch(branch);
};

script();
